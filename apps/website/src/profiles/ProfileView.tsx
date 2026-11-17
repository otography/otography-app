import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { artworkUrl } from "#/lib/musickit";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { favoriteColorStyles } from "./favorite-colors";
import type { Profile } from "./queries";

/** プロフィール（表示名、自己紹介、お気に入りの曲とアーティスト）。 */
export function ProfileView({ profile, actions }: { profile: Profile; actions?: ReactNode }) {
  return (
    <article {...stylex.props(styles.root)}>
      <header {...stylex.props(styles.header)}>
        <h1 {...stylex.props(styles.name)}>{profile.name}</h1>
        {actions}
      </header>
      {profile.bio && <p {...stylex.props(styles.bio)}>{profile.bio}</p>}

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.heading)}>お気に入りの曲</h2>
        {profile.favoriteSongs.length === 0 && (
          <p {...stylex.props(styles.muted)}>まだありません</p>
        )}
        <ul {...stylex.props(styles.list)}>
          {profile.favoriteSongs.map((favorite) => (
            <FavoriteRow
              key={favorite.song.isrc}
              title={favorite.song.title ?? "（曲名なし）"}
              subtitle={favorite.song.artistName}
              artwork={favorite.song.artworkUrl}
              href={favorite.song.url}
              favorite={favorite}
            />
          ))}
        </ul>
      </section>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.heading)}>お気に入りのアーティスト</h2>
        {profile.favoriteArtists.length === 0 && (
          <p {...stylex.props(styles.muted)}>まだありません</p>
        )}
        <ul {...stylex.props(styles.list)}>
          {profile.favoriteArtists.map((favorite) => (
            <FavoriteRow
              key={favorite.artist.id}
              title={favorite.artist.name ?? "（名前なし）"}
              subtitle={null}
              artwork={favorite.artist.artworkUrl}
              href={favorite.artist.url}
              favorite={favorite}
              round
            />
          ))}
        </ul>
      </section>
    </article>
  );
}

type FavoriteDecoration = Profile["favoriteSongs"][number] | Profile["favoriteArtists"][number];

function FavoriteRow({
  title,
  subtitle,
  artwork,
  href,
  favorite,
  round = false,
}: {
  title: string;
  subtitle: string | null;
  artwork: string | null;
  href: string | null;
  favorite: Pick<FavoriteDecoration, "comment" | "emoji" | "color">;
  round?: boolean;
}) {
  return (
    <li {...stylex.props(styles.row, favorite.color && favoriteColorStyles[favorite.color])}>
      {artwork && (
        <img
          src={artworkUrl(artwork, 112)}
          alt=""
          width={56}
          height={56}
          {...stylex.props(styles.artwork, round && styles.round)}
        />
      )}
      <div {...stylex.props(styles.meta)}>
        <span {...stylex.props(styles.title)}>
          {favorite.emoji && <span aria-hidden>{favorite.emoji} </span>}
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" {...stylex.props(styles.link)}>
              {title}
            </a>
          ) : (
            title
          )}
        </span>
        {subtitle && <span {...stylex.props(styles.muted)}>{subtitle}</span>}
        {favorite.comment && <span {...stylex.props(styles.comment)}>{favorite.comment}</span>}
      </div>
    </li>
  );
}

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: space.lg, width: "100%", maxWidth: 640 },
  header: { display: "flex", gap: space.md, alignItems: "center", justifyContent: "space-between" },
  name: { margin: 0, fontSize: 24 },
  bio: { margin: 0, whiteSpace: "pre-wrap" },
  section: { display: "flex", flexDirection: "column", gap: space.sm },
  heading: { margin: 0, fontSize: 16 },
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
    gap: space.md,
    alignItems: "center",
    padding: space.sm,
    borderLeftColor: colors.border,
    borderLeftStyle: "solid",
    borderLeftWidth: 4,
    borderRadius: radius.sm,
  },
  artwork: { borderRadius: radius.sm },
  round: { borderRadius: "50%" },
  meta: { display: "flex", flexDirection: "column", gap: space.xs, minWidth: 0 },
  title: { fontWeight: 600 },
  link: { color: "inherit" },
  muted: { fontSize: 14, color: colors.textMuted },
  comment: { fontSize: 14 },
});
