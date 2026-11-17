import * as stylex from "@stylexjs/stylex";
import { fontTokens } from "./tokens.stylex";
import { TrackArt, type ArtVariant } from "./TrackArt";

const styles = stylex.create({
  pill: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "0.72rem",
    alignItems: "center",
    fontFamily: fontTokens.body,
  },
  title: {
    display: "block",
    fontSize: "0.78rem",
    lineHeight: 1.35,
  },
  subtitle: {
    display: "block",
    fontSize: "0.72rem",
    lineHeight: 1.35,
    color: "#5d6470",
  },
});

type MusicPillProps = {
  artVariant: ArtVariant;
  title: string;
  artist: string;
};

export function MusicPill({ artVariant, title, artist }: MusicPillProps) {
  return (
    <div {...stylex.props(styles.pill)}>
      <TrackArt variant={artVariant} />
      <span>
        <strong {...stylex.props(styles.title)}>{title}</strong>
        <small {...stylex.props(styles.subtitle)}>{artist}</small>
      </span>
    </div>
  );
}
