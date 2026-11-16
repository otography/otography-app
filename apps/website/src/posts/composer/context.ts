import { createContext, use } from "react";
import type { AppleSong } from "#/lib/musickit";

/** 投稿の入力欄が表示に使う状態。 */
export type PostComposerState = {
  song: AppleSong | null;
  content: string;
  /** 本文の文字数（コードポイントで数える）。 */
  length: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  error: string | null;
  /** 直前に投稿できた投稿。 */
  lastPost: { id: string; songTitle: string | null } | null;
};

/** 投稿の入力欄が状態を変えるための操作。 */
export type PostComposerActions = {
  selectSong: (song: AppleSong) => void;
  clearSong: () => void;
  updateContent: (content: string) => void;
  submit: () => void;
};

export type PostComposerMeta = {
  maxLength: number;
};

export type PostComposerContextValue = {
  state: PostComposerState;
  actions: PostComposerActions;
  meta: PostComposerMeta;
};

export const PostComposerContext = createContext<PostComposerContextValue | null>(null);

/** 投稿の入力欄の部品から、Provider が渡した状態と操作を読む。 */
export function usePostComposer() {
  const value = use(PostComposerContext);
  // Provider の外で部品を使うのは実装の誤りなので、例外にする。
  if (!value) throw new Error("PostComposer の部品は、PostComposer の Provider の中で使う");
  return value;
}
