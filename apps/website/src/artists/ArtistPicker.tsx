import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type AppleArtist, artworkUrl, searchArtists } from "#/lib/musickit";
import { useDebouncedValue } from "#/lib/use-debounced-value";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { SmallButton } from "#/ui/button";

/** アーティストを検索して 1 人選ぶ。 */
export function ArtistPicker({ onSelect }: { onSelect: (artist: AppleArtist) => void }) {
  const [term, setTerm] = useState("");
  const query = useDebouncedValue(term.trim(), 300);
  const search = useQuery({
    queryKey: ["artists", "search", query],
    queryFn: () => searchArtists(query),
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div {...stylex.props(styles.root)}>
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="アーティスト名で検索"
        aria-label="アーティストを検索"
        {...stylex.props(styles.input)}
      />
      {search.isFetching && <p {...stylex.props(styles.muted)}>検索中…</p>}
      {search.isError && <p {...stylex.props(styles.error)}>{search.error.message}</p>}
      <ul {...stylex.props(styles.list)}>
        {search.data?.map((artist) => (
          <li key={artist.id} {...stylex.props(styles.row)}>
            {artist.attributes.artwork && (
              <img
                src={artworkUrl(artist.attributes.artwork.url, 96)}
                alt=""
                width={40}
                height={40}
                {...stylex.props(styles.artwork)}
              />
            )}
            <div {...stylex.props(styles.meta)}>
              <span>{artist.attributes.name}</span>
              <span {...stylex.props(styles.muted)}>
                {artist.attributes.genreNames?.join("・")}
              </span>
            </div>
            <SmallButton onClick={() => onSelect(artist)}>選ぶ</SmallButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: space.sm },
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
  row: { display: "flex", gap: space.sm, alignItems: "center" },
  artwork: { borderRadius: "50%" },
  meta: { display: "flex", flexGrow: 1, flexDirection: "column", minWidth: 0 },
  muted: { fontSize: 14, color: colors.textMuted },
  error: { color: colors.accent },
});
