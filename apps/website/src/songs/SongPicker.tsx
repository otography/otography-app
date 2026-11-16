import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type AppleSong, artworkUrl, searchSongs } from "#/lib/musickit";
import { useDebouncedValue } from "#/lib/use-debounced-value";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { PreviewPlayerProvider, usePreviewPlayer } from "./preview-player";

/** 曲を検索して 1 曲選ぶ。ISRC のない曲は選べない（API が受け付けないため）。 */
export function SongPicker({ onSelect }: { onSelect: (song: AppleSong) => void }) {
  const [term, setTerm] = useState("");
  const query = useDebouncedValue(term.trim(), 300);
  const search = useQuery({
    queryKey: ["songs", "search", query],
    queryFn: () => searchSongs(query),
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <PreviewPlayerProvider>
      <div {...stylex.props(styles.root)}>
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="曲名やアーティスト名で検索"
          aria-label="曲を検索"
          {...stylex.props(styles.input)}
        />
        {search.isFetching && <p {...stylex.props(styles.muted)}>検索中…</p>}
        {search.isError && <p {...stylex.props(styles.error)}>{search.error.message}</p>}
        <PreviewError />
        <ul {...stylex.props(styles.list)}>
          {search.data?.map((song) => (
            <SongRow key={song.id} song={song} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </PreviewPlayerProvider>
  );
}

function PreviewError() {
  const { state } = usePreviewPlayer();
  if (!state.error) return null;
  return <p {...stylex.props(styles.error)}>{state.error}</p>;
}

function SongRow({ song, onSelect }: { song: AppleSong; onSelect: (song: AppleSong) => void }) {
  const { state, actions } = usePreviewPlayer();
  const playing = state.playingId === song.id;
  const { name, artistName, artwork, isrc, previews } = song.attributes;

  return (
    <li {...stylex.props(styles.row)}>
      {artwork && (
        <img
          src={artworkUrl(artwork.url, 96)}
          alt=""
          width={48}
          height={48}
          {...stylex.props(styles.artwork)}
        />
      )}
      <div {...stylex.props(styles.meta)}>
        <span {...stylex.props(styles.title)}>{name}</span>
        <span {...stylex.props(styles.muted)}>{artistName}</span>
      </div>
      <button
        type="button"
        disabled={!previews?.length}
        onClick={() => actions.toggle(song)}
        {...stylex.props(styles.button)}
      >
        {playing ? "停止" : "試聴"}
      </button>
      <button
        type="button"
        disabled={!isrc}
        onClick={() => onSelect(song)}
        {...stylex.props(styles.button, styles.primary)}
      >
        選ぶ
      </button>
    </li>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
  },
  input: {
    padding: space.sm,
    fontSize: 16,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: 0,
    margin: 0,
    listStyle: "none",
  },
  row: {
    display: "flex",
    gap: space.sm,
    alignItems: "center",
  },
  artwork: {
    borderRadius: radius.sm,
  },
  meta: {
    display: "flex",
    flexGrow: 1,
    flexDirection: "column",
    minWidth: 0,
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    color: colors.accent,
  },
  button: {
    paddingBlock: space.xs,
    paddingInline: space.sm,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  primary: {
    color: colors.background,
    backgroundColor: {
      default: colors.accent,
      ":disabled": colors.border,
    },
    borderColor: "transparent",
  },
});
