import { useMutation } from "@tanstack/react-query";
import { POST_CONTENT_MAX } from "db/constants";
import { type ReactNode, useState } from "react";
import { client } from "#/lib/api";
import type { AppleSong } from "#/lib/musickit";
import { PostComposerContext } from "./context";

// 絵文字の結合（書記素）は数えない。API・DB の length() と同じ数え方にそろえるため（ADR 0012）。
const countCharacters = (text: string) => Array.from(text.trim()).length;

/**
 * 新しい投稿を作るときの状態と操作。状態の持ち方と API の呼び方は、この Provider だけが知っている。
 * 部品（Composer.*）は context の型だけに依存する。
 */
export function CreatePostProvider({ children }: { children: ReactNode }) {
  const [song, setSong] = useState<AppleSong | null>(null);
  const [content, setContent] = useState("");

  const createPost = useMutation({
    mutationFn: async (input: { songId: string; isrc: string; content: string }) => {
      const res = await client.api.posts.$post({ json: input });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
    onSuccess: () => {
      setSong(null);
      setContent("");
    },
  });

  const length = countCharacters(content);
  const isrc = song?.attributes.isrc;
  const canSubmit =
    !!song && !!isrc && length > 0 && length <= POST_CONTENT_MAX && !createPost.isPending;

  return (
    <PostComposerContext
      value={{
        state: {
          song,
          content,
          length,
          canSubmit,
          isSubmitting: createPost.isPending,
          error: createPost.error?.message ?? null,
          lastPost: createPost.data
            ? { id: createPost.data.id, songTitle: createPost.data.song.title }
            : null,
        },
        actions: {
          selectSong: setSong,
          clearSong: () => setSong(null),
          updateContent: setContent,
          submit: () => {
            if (!canSubmit || !song || !isrc) return;
            createPost.mutate({ songId: song.id, isrc, content });
          },
        },
        meta: { maxLength: POST_CONTENT_MAX },
      }}
    >
      {children}
    </PostComposerContext>
  );
}
