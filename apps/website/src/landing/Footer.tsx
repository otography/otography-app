import * as stylex from "@stylexjs/stylex";
import { Logo } from "./Logo";
import { fontTokens } from "./tokens.stylex";

const styles = stylex.create({
  footer: {
    display: "grid",
    gridTemplateColumns: {
      default: "auto 1fr auto",
      "@media (max-width: 980px)": "1fr",
    },
    gap: "2rem",
    alignItems: "center",
    width: "min(100%, 78rem)",
    padding: "2rem clamp(1.25rem, 3vw, 2.5rem)",
    paddingInline: {
      default: null,
      "@media (max-width: 640px)": "1rem",
    },
    margin: "0 auto",
  },
  footerNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "clamp(1rem, 3vw, 2.5rem)",
    alignItems: "center",
    justifyContent: {
      default: "center",
      "@media (max-width: 980px)": "flex-start",
    },
    fontFamily: fontTokens.body,
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#596070",
  },
  footerLink: {
    color: {
      default: null,
      ":hover": "#6f64e8",
    },
  },
  socialLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: "clamp(1rem, 3vw, 2.5rem)",
    alignItems: "center",
    justifyContent: {
      default: "flex-end",
      "@media (max-width: 980px)": "flex-start",
    },
    fontSize: "1.25rem",
    fontWeight: 720,
    color: "#11151f",
  },
});

export function Footer() {
  return (
    <footer {...stylex.props(styles.footer)}>
      <Logo />
      <nav aria-label="フッターナビゲーション" {...stylex.props(styles.footerNav)}>
        <a href="#about" {...stylex.props(styles.footerLink)}>
          About
        </a>
        <a href="#how-it-works" {...stylex.props(styles.footerLink)}>
          How it works
        </a>
        <a href="#voices" {...stylex.props(styles.footerLink)}>
          Voices
        </a>
        <a href="#terms" {...stylex.props(styles.footerLink)}>
          Terms
        </a>
        <a href="#privacy" {...stylex.props(styles.footerLink)}>
          Privacy
        </a>
        <a href="#contact" {...stylex.props(styles.footerLink)}>
          Contact
        </a>
      </nav>
      <div {...stylex.props(styles.socialLinks)} aria-label="ソーシャルリンク">
        <a href="#x" aria-label="X" {...stylex.props(styles.footerLink)}>
          X
        </a>
        <a href="#instagram" aria-label="Instagram" {...stylex.props(styles.footerLink)}>
          ◎
        </a>
        <a href="#tiktok" aria-label="TikTok" {...stylex.props(styles.footerLink)}>
          ♪
        </a>
      </div>
    </footer>
  );
}
