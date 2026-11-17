import * as stylex from "@stylexjs/stylex";
import { FAVORITE_COLORS, type FavoriteColor } from "db/constants";
import type { ReactNode } from "react";
import { artworkUrl } from "#/lib/musickit";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { PrimaryButton, SmallButton } from "#/ui/button";
import { favoriteColorLabels, favoriteColorStyles } from "../favorite-colors";
import { type FavoriteDraft, useFavorites } from "./context";

function Frame({ children }: { children: ReactNode }) {
  return <section {...stylex.props(styles.frame)}>{children}</section>;
}

function Heading() {
  const { state, meta } = useFavorites();
  return (
    <h2 {...stylex.props(styles.heading)}>
      お気に入りの{meta.label}（{state.items.length} / {meta.max}）
    </h2>
  );
}

/** 編集中のお気に入りの一覧。並び替え・削除・飾り（コメント、絵文字、色）の変更ができる。 */
function List() {
  const { state } = useFavorites();
  if (state.items.length === 0) return <p {...stylex.props(styles.muted)}>まだありません</p>;
  return (
    <ol {...stylex.props(styles.list)}>
      {state.items.map((item, index) => (
        <Item key={item.key} item={item} index={index} last={index === state.items.length - 1} />
      ))}
    </ol>
  );
}

function Item({ item, index, last }: { item: FavoriteDraft; index: number; last: boolean }) {
  const { actions, meta } = useFavorites();
  return (
    <li {...stylex.props(styles.item, item.color && favoriteColorStyles[item.color])}>
      <div {...stylex.props(styles.itemHeader)}>
        {item.artworkUrl && (
          <img src={artworkUrl(item.artworkUrl, 80)} alt="" width={40} height={40} />
        )}
        <div {...stylex.props(styles.meta)}>
          <span>{item.title}</span>
          {item.subtitle && <span {...stylex.props(styles.muted)}>{item.subtitle}</span>}
        </div>
        <SmallButton
          disabled={index === 0}
          onClick={() => actions.move(item.key, -1)}
          aria-label="上へ"
        >
          ↑
        </SmallButton>
        <SmallButton disabled={last} onClick={() => actions.move(item.key, 1)} aria-label="下へ">
          ↓
        </SmallButton>
        <SmallButton onClick={() => actions.remove(item.key)}>外す</SmallButton>
      </div>
      <div {...stylex.props(styles.fields)}>
        <input
          value={item.emoji}
          onChange={(event) => actions.update(item.key, { emoji: event.target.value })}
          placeholder="絵文字"
          aria-label="絵文字"
          {...stylex.props(styles.input, styles.emoji)}
        />
        <select
          value={item.color ?? ""}
          onChange={(event) =>
            actions.update(item.key, {
              color: (event.target.value || null) as FavoriteColor | null,
            })
          }
          aria-label="色"
          {...stylex.props(styles.input)}
        >
          <option value="">色なし</option>
          {FAVORITE_COLORS.map((color) => (
            <option key={color} value={color}>
              {favoriteColorLabels[color]}
            </option>
          ))}
        </select>
        <input
          value={item.comment}
          onChange={(event) => actions.update(item.key, { comment: event.target.value })}
          placeholder={`コメント（${meta.commentMax} 文字まで）`}
          aria-label="コメント"
          maxLength={meta.commentMax}
          {...stylex.props(styles.input, styles.comment)}
        />
      </div>
    </li>
  );
}

/** 追加の欄。上限に達したら、追加の欄の代わりに案内を出す。 */
function Add({ children }: { children: ReactNode }) {
  const { state, meta } = useFavorites();
  if (state.items.length >= meta.max) {
    return <p {...stylex.props(styles.muted)}>上限の {meta.max} 件に達しています</p>;
  }
  return <div {...stylex.props(styles.add)}>{children}</div>;
}

function Save() {
  const { state, actions } = useFavorites();
  return (
    <div {...stylex.props(styles.footer)}>
      <PrimaryButton disabled={!state.dirty || state.isSaving} onClick={actions.save}>
        {state.isSaving ? "保存中…" : "保存する"}
      </PrimaryButton>
      {state.saved && <span role="status">保存しました</span>}
      {state.error && (
        <span role="alert" {...stylex.props(styles.error)}>
          {state.error}
        </span>
      )}
    </div>
  );
}

/** お気に入りの編集の部品。状態と操作は Provider（FavoriteSongsProvider など）から受け取る。 */
export const Favorites = { Frame, Heading, List, Add, Save };

const styles = stylex.create({
  frame: { display: "flex", flexDirection: "column", gap: space.md, width: "100%", maxWidth: 640 },
  heading: { margin: 0, fontSize: 18 },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: 0,
    margin: 0,
    listStyle: "none",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: space.sm,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
  },
  itemHeader: { display: "flex", gap: space.sm, alignItems: "center" },
  meta: { display: "flex", flexGrow: 1, flexDirection: "column", minWidth: 0 },
  fields: { display: "flex", flexWrap: "wrap", gap: space.sm },
  input: {
    padding: space.xs,
    fontSize: 14,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  emoji: { width: 64 },
  comment: { flexGrow: 1, minWidth: 200 },
  add: { display: "flex", flexDirection: "column", gap: space.sm },
  footer: { display: "flex", gap: space.md, alignItems: "center" },
  muted: { fontSize: 14, color: colors.textMuted },
  error: { fontSize: 14, color: colors.accent },
});
