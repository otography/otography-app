import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { motion } from "#/motion.stylex";
import { fontTokens, landingTokens as t } from "./tokens.stylex";
import { Logo } from "./Logo";
import { StartButton } from "./StartButton";

const styles = stylex.create({
  header: {
    position: "relative",
    width: "100%",
    backgroundColor: t.paper,
  },
  headerInner: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: {
      default: "1fr auto 1fr auto",
      "@media (max-width: 980px)": "1fr auto auto",
    },
    gap: {
      default: "2rem",
      "@media (max-width: 640px)": "0.8rem",
    },
    alignItems: "center",
    width: "min(100%, 78rem)",
    minHeight: {
      default: "5rem",
      "@media (max-width: 640px)": "4.5rem",
    },
    paddingBlock: "1rem",
    paddingInline: {
      default: "clamp(1.25rem, 3vw, 2.5rem)",
      "@media (max-width: 640px)": "1rem",
    },
    marginBlock: "0",
    marginInline: "auto",
  },
  nav: {
    display: {
      default: "flex",
      "@media (max-width: 980px)": "none",
    },
    gap: "clamp(1.5rem, 4vw, 4rem)",
    alignItems: "center",
    fontFamily: fontTokens.body,
    fontSize: "0.96rem",
    fontWeight: 600,
    color: "#11151f",
  },
  navLink: {
    color: {
      default: "inherit",
      ":hover": "#6f64e8",
    },
    textDecoration: "none",
  },
  headerPrimaryLinkHidden: {
    // StartButton の display（inline-flex）を、640px 以下でだけ none にする。default を null にすると inline-flex も消える。
    display: {
      default: "inline-flex",
      "@media (max-width: 640px)": "none",
    },
  },
  menuButton: {
    position: "relative",
    display: {
      default: "none",
      "@media (max-width: 980px)": "inline-block",
    },
    width: "2.75rem",
    height: "2.75rem",
    padding: 0,
    overflow: "visible",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderStyle: "none",
    borderWidth: 0,
  },
  menuButtonBarTop: {
    position: "absolute",
    top: "50%",
    left: "50%",
    display: "block",
    width: "1.5rem",
    height: "0.125rem",
    backgroundColor: t.ink,
    borderRadius: "999px",
    transform: "translate(-50%, -50%) translateY(-0.4rem)",
    transition: {
      default: `transform 200ms ${motion.easeOut}`,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
  },
  menuButtonBarBottom: {
    position: "absolute",
    top: "50%",
    left: "50%",
    display: "block",
    width: "1.5rem",
    height: "0.125rem",
    backgroundColor: t.ink,
    borderRadius: "999px",
    transform: "translate(-50%, -50%) translateY(0.4rem)",
    transition: {
      default: `transform 200ms ${motion.easeOut}`,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
  },
  menuButtonBarTopOpen: {
    transform: "translate(-50%, -50%) rotate(45deg)",
  },
  menuButtonBarBottomOpen: {
    transform: "translate(-50%, -50%) rotate(-45deg)",
  },
  mobileNav: {
    position: "absolute",
    top: "100%",
    right: 0,
    left: 0,
    zIndex: 1,
    display: {
      default: "none",
      "@media (max-width: 980px)": "flex",
    },
    visibility: "hidden",
    flexDirection: "column",
    gap: "1.25rem",
    width: "100%",
    paddingBlockStart: "1.5rem",
    paddingBlockEnd: "2rem",
    paddingInline: {
      default: "clamp(1.25rem, 3vw, 2.5rem)",
      "@media (max-width: 640px)": "1rem",
    },
    fontFamily: fontTokens.body,
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "#11151f",
    pointerEvents: "none",
    backgroundColor: t.paper,
    boxShadow: "0 1rem 2rem rgba(17, 21, 29, 0.16)",
    opacity: 0,
    transform: {
      default: "translateY(-6px) scale(0.98)",
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    transformOrigin: "top",
    transition: {
      default: `opacity 200ms ${motion.easeOut}, transform 200ms ${motion.easeOut}, visibility 0s linear 200ms`,
      "@media (prefers-reduced-motion: reduce)": "opacity 150ms ease, visibility 0s linear 150ms",
    },
  },
  mobileNavOpen: {
    visibility: "visible",
    pointerEvents: "auto",
    opacity: 1,
    transform: "translateY(0) scale(1)",
    transition: {
      default: `opacity 200ms ${motion.easeOut}, transform 200ms ${motion.easeOut}, visibility 0s linear 0s`,
      "@media (prefers-reduced-motion: reduce)": "opacity 150ms ease, visibility 0s linear 0s",
    },
  },
  navLinkMobile: {
    color: {
      default: "inherit",
      ":hover": "#6f64e8",
    },
    textDecoration: "none",
  },
});

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <StartButton style={styles.headerPrimaryLinkHidden} />
        <button
          type="button"
          aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsMenuOpen((open) => !open)}
          {...stylex.props(styles.menuButton)}
        >
          <span
            {...stylex.props(styles.menuButtonBarTop, isMenuOpen && styles.menuButtonBarTopOpen)}
          />
          <span
            {...stylex.props(
              styles.menuButtonBarBottom,
              isMenuOpen && styles.menuButtonBarBottomOpen,
            )}
          />
        </button>
      </div>
      <nav
        id="mobile-nav"
        aria-label="モバイルナビゲーション"
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen}
        {...stylex.props(styles.mobileNav, isMenuOpen && styles.mobileNavOpen)}
      >
        <a
          href="#about"
          {...stylex.props(styles.navLinkMobile)}
          onClick={() => setIsMenuOpen(false)}
        >
          About
        </a>
        <a
          href="#how-it-works"
          {...stylex.props(styles.navLinkMobile)}
          onClick={() => setIsMenuOpen(false)}
        >
          How it works
        </a>
        <a
          href="#voices"
          {...stylex.props(styles.navLinkMobile)}
          onClick={() => setIsMenuOpen(false)}
        >
          Voices
        </a>
      </nav>
    </header>
  );
}
