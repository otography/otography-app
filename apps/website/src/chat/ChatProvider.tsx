import { useMutation, useQueryClient } from "@tanstack/react-query";
import { POST_CONTENT_MAX } from "db/constants";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { searchSongs } from "#/lib/musickit";
import type { AppleSong } from "#/lib/musickit";
import { createPost } from "#/lib/posts";
import { ChatContext } from "./ChatContext";
import type { SongSearchTrigger } from "./ChatContext";
import type { ChatTurn } from "./types";

// API・DB の length() と同じコードポイント単位で数える（ADR 0012）。
const countCharacters = (text: string) => Array.from(text.trim()).length;

function parseSongTrigger(value: string): { trigger: SongSearchTrigger; query: string } | null {
  const first = value[0];
  if (first !== "@" && first !== "/") {
    return null;
  }
  const query = value.slice(1);
  if (query.includes("\n") || query.length > 60) {
    return null;
  }
  const spaces = query.match(/ /g)?.length ?? 0;
  if (spaces > 4) {
    return null;
  }
  return { trigger: first, query };
}

export function ChatProvider({
  userPublicId,
  children,
}: {
  userPublicId?: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [turns, setTurns] = useState<Array<ChatTurn>>([]);
  const [selectedSong, setSelectedSong] = useState<AppleSong | null>(null);
  const [draft, setDraft] = useState("");
  const [searchDismissed, setSearchDismissed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isComposing, setComposing] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ id: string; length: number } | null>(null);
  const [songs, setSongs] = useState<Array<AppleSong>>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const [composerEl, setComposerEl] = useState<HTMLFormElement | null>(null);
  const pickerId = useId();

  const triggerMatch = parseSongTrigger(draft);
  const menuOpen = triggerMatch !== null && !searchDismissed;

  const updateDraft = (value: string) => {
    // 曲が未選択のまま通常の文字が入力された場合も、自動で @ 検索モードに入れる。
    if (!selectedSong && value !== "" && !parseSongTrigger(value)) {
      setDraft(`@${value}`);
      setSearchDismissed(false);
      return;
    }
    setDraft(value);
    if (!parseSongTrigger(value)) {
      setSearchDismissed(false);
    }
  };

  const searchQuery = triggerMatch?.query.trim() ?? "";
  const activeSearchQuery = menuOpen ? searchQuery : "";

  // 曲検索のメニューが開いている間、入力に合わせて候補を debounce 付きで取得する。
  useEffect(() => {
    if (!activeSearchQuery) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setSongsLoading(true);
      searchSongs(activeSearchQuery)
        .then((result) => {
          if (cancelled) {
            return;
          }
          setSongs(result);
          setHighlightedIndex(0);
          setSongsLoading(false);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setSongs([]);
          setSongsLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeSearchQuery]);

  const visibleSongs = activeSearchQuery ? songs : [];
  const visibleSongsLoading = activeSearchQuery ? songsLoading : false;
  const visibleHighlightedIndex = activeSearchQuery ? highlightedIndex : 0;

  const registerTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
  }, []);
  const registerComposer = useCallback((el: HTMLFormElement | null) => {
    composerRef.current = el;
    setComposerEl((prev) => (prev === el ? prev : el));
  }, []);

  const moveHighlight = (direction: -1 | 1) => {
    if (songs.length === 0) {
      return;
    }
    setHighlightedIndex((prev) => (prev + direction + songs.length) % songs.length);
  };

  const selectSong = (song: AppleSong) => {
    if (!song.attributes.isrc) {
      return;
    }
    setSelectedSong(song);
    setDraft("");
    setSearchDismissed(false);
    textareaRef.current?.focus();
  };

  const openSongSearch = (trigger: SongSearchTrigger) => {
    setSearchDismissed(false);
    const nextValue =
      draft.startsWith("@") || draft.startsWith("/")
        ? `${trigger}${draft.slice(1)}`
        : `${trigger}${draft}`;
    setDraft(nextValue);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.focus();
      const pos = nextValue.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: (created, variables) => {
      setTurns((prev) => [
        ...prev,
        {
          id: `assistant-${created.id}`,
          kind: "assistant",
          postId: created.id,
          songTitle: created.song.title ?? variables.songId,
          createdAt: new Date(),
        },
      ]);
      if (userPublicId) {
        void queryClient.invalidateQueries({ queryKey: ["users", "posts", userPublicId] });
      }
    },
    onError: (error) => {
      setTurns((prev) => [
        ...prev,
        {
          id: `error-${crypto.randomUUID()}`,
          kind: "assistant-error",
          message: error.message,
          createdAt: new Date(),
        },
      ]);
    },
  });

  const length = countCharacters(draft);
  const isrc = selectedSong?.attributes.isrc;
  const canSubmit =
    !!selectedSong && !!isrc && length > 0 && length <= POST_CONTENT_MAX && !mutation.isPending;

  const submit = () => {
    if (!canSubmit || !selectedSong || !isrc) {
      return;
    }
    textareaRef.current?.blur();
    const content = draft.trim();
    const song = selectedSong;
    const submissionId = crypto.randomUUID();

    setLastSubmission({ id: submissionId, length: content.length });
    setTurns((prev) => [
      ...prev,
      {
        id: `user-${submissionId}`,
        kind: "user",
        song,
        content,
        createdAt: new Date(),
      },
    ]);
    setSelectedSong(null);
    setDraft("");

    mutation.mutate({ songId: song.id, isrc, content });
  };

  return (
    <ChatContext
      value={{
        state: {
          turns,
          selectedSong,
          draft,
          length,
          canSubmit,
          isSubmitting: mutation.isPending,
          isComposing,
          lastSubmission,
          searchTrigger: triggerMatch?.trigger ?? null,
          searchQuery,
          menuOpen,
          keyboardOpen,
          songs: visibleSongs,
          songsLoading: visibleSongsLoading,
          highlightedIndex: visibleHighlightedIndex,
        },
        actions: {
          selectSong,
          clearSong: () => setSelectedSong(null),
          updateDraft,
          setComposing,
          openSongSearch,
          dismissSongSearch: () => setSearchDismissed(true),
          submit,
          setKeyboardOpen,
          highlightSong: setHighlightedIndex,
          moveHighlight,
          registerTextarea,
          registerComposer,
        },
        meta: {
          maxLength: POST_CONTENT_MAX,
          textareaRef,
          composerRef,
          composerEl,
          pickerId,
        },
      }}
    >
      {children}
    </ChatContext>
  );
}
