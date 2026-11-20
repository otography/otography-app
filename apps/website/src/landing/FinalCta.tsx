import * as stylex from "@stylexjs/stylex";
import { BudouxText } from "./BudouxText";
import { fontTokens, landingTokens as t } from "./tokens.stylex";
import { StartButton } from "./StartButton";

const styles = stylex.create({
  finalCta: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) auto",
      "@media (max-width: 980px)": "1fr",
    },
    gap: "2rem",
    alignItems: "center",
    justifyItems: {
      default: null,
      "@media (max-width: 980px)": "start",
    },
    minHeight: "15rem",
    paddingBlock: "3.5rem",
    paddingInline: {
      default: "max(clamp(1.25rem, 6vw, 7rem), calc((100vw - 78rem) / 2 + 2.5rem))",
      "@media (max-width: 640px)": "1rem",
    },
    borderTopColor: t.line,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
  },
  ctaPurpleAura: {
    position: "absolute",
    bottom: {
      default: "-10rem",
      "@media (max-width: 640px)": "-8.8rem",
    },
    left: {
      default: "-4.5rem",
      "@media (max-width: 640px)": "-9rem",
    },
    width: {
      default: "min(39rem, 66vw)",
      "@media (max-width: 640px)": "28rem",
    },
    maxWidth: {
      default: null,
      "@media (max-width: 640px)": "none",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
  },
  ctaPinkOrb: {
    position: "absolute",
    bottom: {
      default: "2.7rem",
      "@media (max-width: 640px)": "7.8rem",
    },
    left: {
      default: "6.2rem",
      "@media (max-width: 640px)": "4.1rem",
    },
    width: {
      default: "min(7.5rem, 15vw)",
      "@media (max-width: 640px)": "5.6rem",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
    clipPath: "circle(37% at 50% 50%)",
  },
  ctaGoldOrb: {
    position: "absolute",
    bottom: {
      default: "-4.3rem",
      "@media (max-width: 640px)": "3.1rem",
    },
    left: {
      default: "10.2rem",
      "@media (max-width: 640px)": "8.4rem",
    },
    width: {
      default: "min(12rem, 22vw)",
      "@media (max-width: 640px)": "8.8rem",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
  },
  finalCtaText: {
    position: "relative",
    zIndex: 1,
    justifySelf: {
      default: "center",
      "@media (max-width: 980px)": "start",
    },
    maxWidth: "37rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "clamp(1.45rem, 3vw, 2rem)",
    fontWeight: 700,
    lineHeight: 1.8,
    letterSpacing: "0.08em",
  },
  finalCtaActions: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "1rem",
    justifyItems: "center",
    justifySelf: {
      default: null,
      "@media (max-width: 980px)": "center",
    },
  },
  finalCtaPrimaryLink: {
    justifySelf: "center",
  },
  finalCtaSmall: {
    fontFamily: fontTokens.body,
    fontSize: "0.82rem",
    fontWeight: 500,
    color: "#2b303d",
    textAlign: {
      default: null,
      "@media (max-width: 640px)": "center",
    },
    letterSpacing: "0.08em",
  },
});

export function FinalCta() {
  return (
    <section {...stylex.props(styles.finalCta)}>
      <img
        alt=""
        aria-hidden="true"
        height={1024}
        src="/lp-asset-7.png"
        width={1535}
        {...stylex.props(styles.ctaPurpleAura)}
      />
      <img
        alt=""
        aria-hidden="true"
        height={511}
        src="/lp-asset-8.webp"
        width={511}
        {...stylex.props(styles.ctaPinkOrb)}
      />
      <img
        alt=""
        aria-hidden="true"
        height={1254}
        src="/lp-asset-9.png"
        width={1254}
        {...stylex.props(styles.ctaGoldOrb)}
      />
      <p {...stylex.props(styles.finalCtaText)}>
        <BudouxText text="あなたの言葉が、誰かの音楽体験を変えるかもしれない。" />
      </p>
      <div {...stylex.props(styles.finalCtaActions)}>
        <StartButton style={styles.finalCtaPrimaryLink} />
        <small {...stylex.props(styles.finalCtaSmall)}>
          <BudouxText text="アカウント登録なしでも閲覧できます" />
        </small>
      </div>
    </section>
  );
}
