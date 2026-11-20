import { useMutation } from "@tanstack/react-query";
import { POST_CONTENT_MAX } from "db/constants";
import { type ReactNode, useRef, useState } from "react";
import type { AppleSong } from "#/lib/musickit";
import { createPost } from "#/lib/posts";
import { ChatContext, type SongSearchTrigger } from "./ChatContext";
import type { ChatTurn } from "./types";

// API・DB の length() と同じコードポイント単位で数える（ADR 0012）。
const countCharacters = (text: string) => Array.from(text.trim()).length;

function parseSongTrigger(value: string): { trigger: SongSearchTrigger; query: string } | null {
  const first = value[0];
  if (first !== "@" && first !== "/") return null;
  const query = value.slice(1);
  if (query.includes("\n") || query.length > 60) return null;
  const spaces = query.match(/ /g)?.length ?? 0;
  if (spaces > 4) return null;
  return { trigger: first, query };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selectedSong, setSelectedSong] = useState<AppleSong | null>(null);
  const [draft, setDraft] = useState("");
  const [searchDismissed, setSearchDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const triggerMatch = parseSongTrigger(draft);
  const menuOpen = triggerMatch !== null && !searchDismissed;

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!parseSongTrigger(value)) {
      setSearchDismissed(false);
    }
  };

  const selectSong = (song: AppleSong) => {
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
      if (!el) return;
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
    if (!canSubmit || !selectedSong || !isrc) return;
    const content = draft.trim();
    const song = selectedSong;

    setTurns((prev) => [
      ...prev,
      {
        id: `user-${crypto.randomUUID()}`,
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
          searchTrigger: triggerMatch?.trigger ?? null,
          searchQuery: triggerMatch?.query.trim() ?? "",
          menuOpen,
        },
        actions: {
          selectSong,
          clearSong: () => setSelectedSong(null),
          updateDraft,
          openSongSearch,
          dismissSongSearch: () => setSearchDismissed(true),
          submit,
        },
        meta: {
          maxLength: POST_CONTENT_MAX,
          textareaRef,
        },
      }}
    >
      {children}
    </ChatContext>
  );
}
