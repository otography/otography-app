import { useMutation } from "@tanstack/react-query";
import { createTriggerMenuController } from "@ui-sdk/react/trigger-menu";
import { POST_CONTENT_MAX } from "db/constants";
import { type ReactNode, useState } from "react";
import type { AppleSong } from "#/lib/musickit";
import { createPost } from "#/lib/posts";
import { ChatContext } from "./ChatContext";
import type { ChatTurn } from "./types";

// API・DB の length() と同じコードポイント単位で数える（ADR 0012）。
const countCharacters = (text: string) => Array.from(text.trim()).length;

export function ChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selectedSong, setSelectedSong] = useState<AppleSong | null>(null);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuController] = useState(createTriggerMenuController);

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
          menuOpen,
        },
        actions: {
          selectSong: setSelectedSong,
          clearSong: () => setSelectedSong(null),
          updateDraft: setDraft,
          setMenuOpen,
          submit,
        },
        meta: {
          maxLength: POST_CONTENT_MAX,
          menuController,
        },
      }}
    >
      {children}
    </ChatContext>
  );
}
