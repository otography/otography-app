import * as stylex from "@stylexjs/stylex";
import { fontBody, landingTokens as t } from "./tokens.stylex";
import { Logo } from "./logo";
import { PrimaryLink } from "./primary-link";

const styles = stylex.create({
  header: {
    width: "100%",
  },
  headerInner: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr auto",
    alignItems: "center",
    gap: "2rem",
    width: "min(100%, 78rem)",
    minHeight: "5rem",
    margin: "0 auto",
    paddingBlock: "1rem",
    paddingInline: "clamp(1.25rem, 3vw, 2.5rem)",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr auto auto",
    },
    "@media (max-width: 640px)": {
      minHeight: "4.5rem",
      gap: "0.8rem",
      paddingInline: "1rem",
    },
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(1.5rem, 4vw, 4rem)",
    color: "#11151f",
    fontFamily: fontBody,
    fontSize: "0.96rem",
    fontWeight: 600,
    "@media (max-width: 980px)": {
      display: "none",
    },
  },
  navLink: {
    ":hover": {
      color: "#6f64e8",
    },
  },
  headerPrimaryLinkHidden: {
    "@media (max-width: 640px)": {
      display: "none",
    },
  },
  menuButton: {
    display: "inline-grid",
    placeItems: "center",
    gap: "0.35rem",
    width: "2.75rem",
    height: "2.75rem",
    padding: "0.75rem",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "transparent",
  },
  menuButtonBar: {
    display: "block",
    width: "1.25rem",
    height: "0.1rem",
    backgroundColor: t.ink,
    borderRadius: "999px",
  },
});

export function Header({ ctaHref }: { ctaHref: string }) {
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.headerInner)}>
        <Logo />
        <nav aria-label="メインナビゲーション" {...stylex.props(styles.nav)}>
          <a href="#about" {...stylex.props(styles.navLink)}>
            About
          </a>
          <a href="#how-it-works" {...stylex.props(styles.navLink)}>
            How it works
          </a>
          <a href="#voices" {...stylex.props(styles.navLink)}>
            Voices
          </a>
        </nav>
        <PrimaryLink href={ctaHref} style={styles.headerPrimaryLinkHidden} />
        <button aria-label="メニューを開く" {...stylex.props(styles.menuButton)}>
          <span {...stylex.props(styles.menuButtonBar)} />
          <span {...stylex.props(styles.menuButtonBar)} />
        </button>
      </div>
    </header>
  );
}
