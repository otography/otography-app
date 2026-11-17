import { FAVORITE_LIMIT } from "db/constants";
import { useState } from "react";
import type { FavoriteDraft, FavoritesActions } from "./context";

/** お気に入りの一覧の編集（追加・削除・並び替え・飾りの変更）。保存の方法は Provider が決める。 */
export function useFavoriteDrafts(initial: FavoriteDraft[]) {
  const [items, setItems] = useState(initial);
  const [dirty, setDirty] = useState(false);

  const change = (next: (items: FavoriteDraft[]) => FavoriteDraft[]) => {
    setItems(next);
    setDirty(true);
  };

  const actions: Omit<FavoritesActions, "save"> = {
    add: (draft) =>
      change((current) =>
        current.length >= FAVORITE_LIMIT || current.some((item) => item.key === draft.key)
          ? current
          : [...current, draft],
      ),
    remove: (key) => change((current) => current.filter((item) => item.key !== key)),
    move: (key, offset) =>
      change((current) => {
        const from = current.findIndex((item) => item.key === key);
        const to = from + offset;
        if (from < 0 || to < 0 || to >= current.length) return current;
        const next = [...current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item!);
        return next;
      }),
    update: (key, patch) =>
      change((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item))),
  };

  /** 保存できたときに、保存した内容を新しい基準にする。 */
  const reset = (next: FavoriteDraft[]) => {
    setItems(next);
    setDirty(false);
  };

  return { items, dirty, actions, reset };
}

/** 保存の API に送る飾りの値。空の文字列は送らない（API は NULL として保存する）。 */
export const decorationOf = (draft: FavoriteDraft) => ({
  comment: draft.comment.trim() || null,
  emoji: draft.emoji.trim() || null,
  color: draft.color,
});
