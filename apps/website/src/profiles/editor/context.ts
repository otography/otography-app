import type { FavoriteColor } from "db/constants";
import { createContext, use } from "react";

/** 編集中のお気に入り 1 件。曲とアーティストで共通の形にする。 */
export type FavoriteDraft = {
  /** 重複を見分けるための値（曲は ISRC、アーティストは Apple の ID）。 */
  key: string;
  /** 保存の API に送る、対象を指す値（曲は songId と isrc、アーティストは artistId）。 */
  target: Record<string, string>;
  title: string;
  subtitle: string | null;
  artworkUrl: string | null;
  comment: string;
  emoji: string;
  color: FavoriteColor | null;
};

export type FavoritesState = {
  items: FavoriteDraft[];
  /** 保存していない変更があるか。 */
  dirty: boolean;
  isSaving: boolean;
  error: string | null;
  saved: boolean;
};

export type FavoritesActions = {
  add: (draft: FavoriteDraft) => void;
  remove: (key: string) => void;
  move: (key: string, offset: -1 | 1) => void;
  update: (key: string, patch: Partial<Pick<FavoriteDraft, "comment" | "emoji" | "color">>) => void;
  save: () => void;
};

export type FavoritesMeta = {
  label: string;
  max: number;
  commentMax: number;
};

export type FavoritesContextValue = {
  state: FavoritesState;
  actions: FavoritesActions;
  meta: FavoritesMeta;
};

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** お気に入りの編集の部品から、Provider が渡した状態と操作を読む。 */
export function useFavorites() {
  const value = use(FavoritesContext);
  if (!value) throw new Error("Favorites の部品は、お気に入りの Provider の中で使う");
  return value;
}
