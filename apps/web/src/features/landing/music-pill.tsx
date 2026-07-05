import * as stylex from "@stylexjs/stylex";
import { fontBody } from "./tokens.stylex";
import { TrackArt, type ArtVariant } from "./track-art";

const styles = stylex.create({
  pill: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "0.72rem",
    alignItems: "center",
    fontFamily: fontBody,
  },
  title: {
    display: "block",
    lineHeight: 1.35,
    fontSize: "0.78rem",
  },
  subtitle: {
    display: "block",
    lineHeight: 1.35,
    color: "#5d6470",
    fontSize: "0.72rem",
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
