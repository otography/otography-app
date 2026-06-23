import * as stylex from "@stylexjs/stylex";
import { Logo } from "./logo";

const styles = stylex.create({
  footer: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: "2rem",
    alignItems: "center",
    width: "min(100%, 78rem)",
    margin: "0 auto",
    padding: "2rem clamp(1.25rem, 3vw, 2.5rem)",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  footerNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "clamp(1rem, 3vw, 2.5rem)",
    alignItems: "center",
    justifyContent: "center",
    color: "#596070",
    fontSize: "0.78rem",
    fontWeight: 560,
    "@media (max-width: 980px)": {
      justifyContent: "flex-start",
    },
  },
  footerLink: {
    ":hover": {
      color: "#6f64e8",
    },
  },
  socialLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: "clamp(1rem, 3vw, 2.5rem)",
    alignItems: "center",
    justifyContent: "flex-end",
    color: "#11151f",
    fontSize: "1.25rem",
    fontWeight: 720,
    "@media (max-width: 980px)": {
      justifyContent: "flex-start",
    },
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
