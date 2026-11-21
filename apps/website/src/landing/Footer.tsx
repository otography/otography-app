import { create, props } from "@stylexjs/stylex";
import { motion } from "#/motion.stylex";
import { Logo } from "./Logo";
import { fontTokens, landingMedia } from "./tokens.stylex";

const styles = create({
  footer: {
    display: "grid",
    gridTemplateColumns: {
      default: "auto 1fr auto",
      "@media (max-width: 980px)": "1fr",
    },
    gap: "2rem",
    alignItems: "center",
    width: "min(100%, 78rem)",
    paddingInline: {
      default: "clamp(1.25rem, 3vw, 2.5rem)",
      "@media (max-width: 640px)": "1rem",
    },
    paddingTop: "2rem",
    paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
    marginBlock: "0",
    marginInline: "auto",
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
      default: "inherit",
      ":hover": {
        default: "inherit",
        [landingMedia.hover]: "#6f64e8",
      },
    },
    textDecoration: "none",
    opacity: {
      default: 1,
      ":active": 0.65,
    },
    transition: `color 120ms ${motion.easeOut}, opacity 120ms ${motion.easeOut}`,
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
    <footer {...props(styles.footer)}>
      <Logo />
      <nav aria-label="フッターナビゲーション" {...props(styles.footerNav)}>
        <a href="#about" {...props(styles.footerLink)}>
          About
        </a>
        <a href="#how-it-works" {...props(styles.footerLink)}>
          How it works
        </a>
        <a href="#voices" {...props(styles.footerLink)}>
          Voices
        </a>
        <a href="#terms" {...props(styles.footerLink)}>
          Terms
        </a>
        <a href="#privacy" {...props(styles.footerLink)}>
          Privacy
        </a>
        <a href="#contact" {...props(styles.footerLink)}>
          Contact
        </a>
      </nav>
      <div {...props(styles.socialLinks)} aria-label="ソーシャルリンク">
        <a href="#x" aria-label="X" {...props(styles.footerLink)}>
          X
        </a>
        <a href="#instagram" aria-label="Instagram" {...props(styles.footerLink)}>
          ◎
        </a>
        <a href="#tiktok" aria-label="TikTok" {...props(styles.footerLink)}>
          ♪
        </a>
      </div>
    </footer>
  );
}
