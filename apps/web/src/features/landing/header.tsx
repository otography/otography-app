"use client";

import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { fontTokens, landingTokens as t } from "./tokens.stylex";
import { Logo } from "./logo";
import { PrimaryLink } from "./primary-link";

const styles = stylex.create({
  header: {
    width: "100%",
    position: "relative",
    backgroundColor: t.paper,
  },
  headerInner: {
    position: "relative",
    zIndex: 2,
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
    fontFamily: fontTokens.body,
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
    position: "relative",
    display: "none",
    width: "2.75rem",
    height: "2.75rem",
    padding: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "transparent",
    overflow: "visible",
    "@media (max-width: 980px)": {
      display: "inline-block",
    },
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
    transition: "transform 0.2s ease",
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
    transition: "transform 0.2s ease",
  },
  menuButtonBarTopOpen: {
    transform: "translate(-50%, -50%) rotate(45deg)",
  },
  menuButtonBarBottomOpen: {
    transform: "translate(-50%, -50%) rotate(-45deg)",
  },
  mobileNav: {
    display: "none",
    position: "absolute",
    zIndex: 1,
    top: "100%",
    left: 0,
    right: 0,
    flexDirection: "column",
    gap: "1.25rem",
    width: "100%",
    backgroundColor: t.paper,
    boxShadow: "0 1rem 2rem rgba(17, 21, 29, 0.16)",
    paddingBlock: "1.5rem 2rem",
    paddingInline: "clamp(1.25rem, 3vw, 2.5rem)",
    color: "#11151f",
    fontFamily: fontTokens.body,
    fontSize: "1.05rem",
    fontWeight: 600,
    "@media (max-width: 980px)": {
      display: "flex",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  navLinkMobile: {
    ":hover": {
      color: "#6f64e8",
    },
  },
});

export function Header({ ctaHref }: { ctaHref: string }) {
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
        <PrimaryLink href={ctaHref} style={styles.headerPrimaryLinkHidden} />
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
      {isMenuOpen && (
        <nav
          id="mobile-nav"
          aria-label="モバイルナビゲーション"
          {...stylex.props(styles.mobileNav)}
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
      )}
    </header>
  );
}
