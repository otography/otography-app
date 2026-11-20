import * as stylex from "@stylexjs/stylex";
import { BudouxText } from "./BudouxText";
import { fontTokens, landingTokens as t } from "./tokens.stylex";

const styles = stylex.create({
  howItWorks: {
    display: "grid",
    gap: "1.5rem",
    width: "100%",
    paddingBlock: "clamp(3rem,6vw,5rem)",
    paddingInline: {
      default: "clamp(1.25rem, 3vw, 2.5rem)",
      "@media (max-width: 640px)": "1rem",
    },
    marginBlock: "0",
    marginInline: "auto",
    backgroundImage:
      "radial-gradient(circle at 86% 85%, rgba(186, 176, 255, 0.34), transparent 18rem), radial-gradient(circle at 76% 90%, rgba(244, 165, 183, 0.25), transparent 13rem)",
    borderTopColor: t.line,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    borderBottomColor: t.line,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
  },
  kicker: {
    fontFamily: fontTokens.mono,
    fontSize: "0.84rem",
    fontWeight: 760,
    color: "#8177ec",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    fontFamily: fontTokens.heading,
    fontSize: "clamp(2rem, 4vw, 2.75rem)",
    fontWeight: 700,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  bodyText: {
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "1.02rem",
    fontWeight: 400,
    lineHeight: 2.05,
    color: "#242936",
    letterSpacing: "0.03em",
  },
});

export function HowItWorks() {
  return (
    <section {...stylex.props(styles.howItWorks)} id="how-it-works">
      <span {...stylex.props(styles.kicker)}>HOW IT WORKS</span>
      <h2 {...stylex.props(styles.sectionTitle)}>
        <BudouxText text="感想がつなぐ、音楽との出会い。" />
      </h2>
      <p {...stylex.props(styles.bodyText)}>
        <BudouxText text="楽曲を聴いて浮かんだ気持ちや情景を、短い言葉で気軽に投稿する。他の人の感想を読んで、気になる曲を見つけて聴いてみる。そうやって一つの楽曲に、いろんな人のいろんな言葉が積もっていき、その曲の新しい一面が見えてきます。" />
      </p>
    </section>
  );
}
