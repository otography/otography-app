import Image from "next/image";
import * as stylex from "@stylexjs/stylex";
import { landingTokens as t } from "./tokens.stylex";
import { PrimaryLink } from "./primary-link";

const styles = stylex.create({
  finalCta: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "2rem",
    alignItems: "center",
    minHeight: "15rem",
    padding: "3.5rem max(clamp(1.25rem, 6vw, 7rem), calc((100vw - 78rem) / 2 + 2.5rem))",
    overflow: "hidden",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: t.line,
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr",
      justifyItems: "start",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  ctaPurpleAura: {
    position: "absolute",
    pointerEvents: "none",
    userSelect: "none",
    bottom: "-10rem",
    left: "-4.5rem",
    width: "min(39rem, 66vw)",
    height: "auto",
    "@media (max-width: 640px)": {
      bottom: "-8.8rem",
      left: "-9rem",
      width: "28rem",
      maxWidth: "none",
    },
  },
  ctaPinkOrb: {
    position: "absolute",
    pointerEvents: "none",
    userSelect: "none",
    bottom: "2.7rem",
    left: "6.2rem",
    width: "min(7.5rem, 15vw)",
    height: "auto",
    clipPath: "circle(37% at 50% 50%)",
    "@media (max-width: 640px)": {
      bottom: "7.8rem",
      left: "4.1rem",
      width: "5.6rem",
    },
  },
  ctaGoldOrb: {
    position: "absolute",
    pointerEvents: "none",
    userSelect: "none",
    bottom: "-4.3rem",
    left: "10.2rem",
    width: "min(12rem, 22vw)",
    height: "auto",
    clipPath: "circle(29% at 50% 52%)",
    filter: "saturate(0.72) brightness(1.08) blur(0.4px)",
    "@media (max-width: 640px)": {
      bottom: "3.1rem",
      left: "8.4rem",
      width: "8.8rem",
    },
  },
  finalCtaText: {
    position: "relative",
    zIndex: 1,
    justifySelf: "center",
    maxWidth: "37rem",
    margin: 0,
    fontSize: "clamp(1.45rem, 3vw, 2rem)",
    fontWeight: 720,
    lineHeight: 1.8,
    letterSpacing: "0.08em",
    "@media (max-width: 980px)": {
      justifySelf: "start",
    },
  },
  finalCtaActions: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "1rem",
    justifyItems: "center",
  },
  finalCtaSmall: {
    color: "#2b303d",
    fontSize: "0.82rem",
    fontWeight: 650,
    letterSpacing: "0.08em",
    "@media (max-width: 640px)": {
      textAlign: "center",
    },
  },
});

export function FinalCta({ ctaHref }: { ctaHref: string }) {
  return (
    <section {...stylex.props(styles.finalCta)}>
      <Image
        alt=""
        aria-hidden="true"
        height={1024}
        src="/lp-asset-7.png"
        width={1535}
        {...stylex.props(styles.ctaPurpleAura)}
      />
      <Image
        alt=""
        aria-hidden="true"
        height={511}
        src="/lp-asset-8.webp"
        width={511}
        {...stylex.props(styles.ctaPinkOrb)}
      />
      <Image
        alt=""
        aria-hidden="true"
        height={1254}
        src="/lp-asset-9.png"
        width={1254}
        {...stylex.props(styles.ctaGoldOrb)}
      />
      <p {...stylex.props(styles.finalCtaText)}>
        あなたの言葉が、誰かの音楽体験を変えるかもしれない。
      </p>
      <div {...stylex.props(styles.finalCtaActions)}>
        <PrimaryLink href={ctaHref} />
        <small {...stylex.props(styles.finalCtaSmall)}>
          アカウント登録なしでも投稿や閲覧ができます
        </small>
      </div>
    </section>
  );
}
