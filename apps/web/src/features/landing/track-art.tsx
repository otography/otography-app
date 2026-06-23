import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";

const baseStyles = stylex.create({
  base: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#e9e2d5",
    borderRadius: "0.45rem",
    width: "3rem",
    height: "3rem",
    "::after": {
      position: "absolute",
      inset: 0,
      content: '""',
      backgroundImage:
        "linear-gradient(rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)), radial-gradient(circle at 70% 26%, rgba(255, 255, 255, 0.55), transparent 22%)",
    },
  },
});

const artStyles = stylex.create({
  coast: {
    backgroundImage:
      "linear-gradient(180deg, rgba(187, 234, 240, 0.85) 0 45%, rgba(129, 197, 219, 0.88) 45% 60%, #86bad0 60% 100%), radial-gradient(circle at 72% 22%, rgba(255, 212, 157, 0.8), transparent 22%)",
  },
  forest: {
    backgroundImage:
      "linear-gradient(145deg, rgba(45, 80, 62, 0.94), rgba(73, 126, 100, 0.86)), radial-gradient(circle at 52% 34%, rgba(229, 210, 133, 0.76), transparent 30%)",
  },
  pastel: {
    backgroundImage:
      "radial-gradient(circle at 26% 28%, #c2b5ff 0 18%, transparent 19%), radial-gradient(circle at 70% 62%, #ffd3ac 0 20%, transparent 21%), linear-gradient(135deg, #f4a7c3, #9fceef)",
  },
  dusk: {
    backgroundImage:
      "linear-gradient(180deg, #473d94 0%, #c24d87 46%, #1e354d 100%), radial-gradient(circle at 22% 24%, rgba(255, 203, 112, 0.9), transparent 22%)",
  },
  green: {
    backgroundImage:
      "linear-gradient(140deg, #163a36, #659b76 54%, #d7c98b), radial-gradient(circle at 70% 24%, rgba(245, 232, 172, 0.78), transparent 20%)",
  },
  window: {
    backgroundImage:
      "linear-gradient(105deg, #c49398 0 38%, #f4d4c5 38% 55%, #8a5d72 55% 100%), radial-gradient(circle at 38% 42%, rgba(255, 235, 212, 0.85), transparent 26%)",
  },
  room: {
    backgroundImage:
      "linear-gradient(90deg, #d4d8d0 0 34%, #eff0e8 34% 60%, #a8b0a6 60% 100%), radial-gradient(circle at 30% 72%, rgba(255, 255, 255, 0.72), transparent 30%)",
  },
});

export type ArtVariant = keyof typeof artStyles;

type TrackArtProps = {
  variant: ArtVariant;
  style?: StyleXStyles<{
    width?: string;
    height?: string;
    aspectRatio?: string;
    gridRow?: string | number;
    "@media (max-width: 640px)"?: { gridRow?: string | number };
  }>;
  label?: string;
};

export function TrackArt({ variant, style, label }: TrackArtProps) {
  if (label) {
    return (
      <div
        role="img"
        aria-label={label}
        {...stylex.props(baseStyles.base, artStyles[variant], style)}
      />
    );
  }
  return <span {...stylex.props(baseStyles.base, artStyles[variant], style)} aria-hidden="true" />;
}
