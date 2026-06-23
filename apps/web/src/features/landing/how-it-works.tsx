import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { landingTokens as t } from "./tokens.stylex";
import { PhoneMock } from "./phone-mock";

const styles = stylex.create({
  howItWorks: {
    display: "grid",
    gridTemplateColumns: "minmax(18rem, 0.9fr) minmax(18rem, 0.7fr) minmax(9rem, 0.45fr)",
    gap: "clamp(2.5rem, 7vw, 6rem)",
    alignItems: "center",
    width: "100%",
    padding:
      "clamp(3rem, 6vw, 5rem) max(clamp(1.25rem, 6vw, 7rem), calc((100vw - 78rem) / 2 + 2.5rem))",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: t.line,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: t.line,
    backgroundImage:
      "radial-gradient(circle at 86% 85%, rgba(186, 176, 255, 0.34), transparent 18rem), radial-gradient(circle at 76% 90%, rgba(244, 165, 183, 0.25), transparent 13rem)",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  sectionCopy: {
    display: "grid",
    alignContent: "start",
    gap: "1.25rem",
  },
  kicker: {
    color: "#8177ec",
    fontSize: "0.84rem",
    fontWeight: 760,
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    fontSize: "clamp(2rem, 4vw, 2.75rem)",
    fontWeight: 680,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  steps: {
    display: "grid",
    gap: "1.5rem",
    marginTop: "0.4rem",
    listStyle: "none",
  },
  stepItem: {
    display: "grid",
    gridTemplateColumns: "3rem 1fr",
    gap: "1.1rem",
    alignItems: "start",
    "@media (max-width: 640px)": {
      gridTemplateColumns: "2.7rem 1fr",
    },
  },
  stepNumber: {
    display: "grid",
    placeItems: "center",
    width: "2.85rem",
    height: "2.85rem",
    fontWeight: 720,
    backgroundColor: t.violetSoft,
    borderRadius: "50%",
  },
  stepNumber2: {
    backgroundColor: "#ffe0a7",
  },
  stepNumber3: {
    backgroundColor: "#ffc0c4",
  },
  stepTitle: {
    marginBottom: "0.45rem",
    fontSize: "1.04rem",
    fontWeight: 780,
    letterSpacing: "0.04em",
  },
  stepText: {
    margin: 0,
    color: "#242936",
    fontSize: "0.94rem",
    fontWeight: 520,
    lineHeight: 1.95,
    letterSpacing: "0.03em",
  },
  sideStatement: {
    position: "relative",
    maxWidth: "11rem",
    margin: 0,
    padding: "4.8rem 0",
    fontSize: "1.35rem",
    fontWeight: 560,
    lineHeight: 1.18,
    "::before": {
      position: "absolute",
      left: "0.2rem",
      top: 0,
      width: "0.5rem",
      height: "0.5rem",
      content: '""',
      backgroundColor: "#bec0c8",
      borderRadius: "50%",
    },
    "::after": {
      position: "absolute",
      left: "0.2rem",
      bottom: 0,
      width: "0.5rem",
      height: "0.5rem",
      content: '""',
      backgroundColor: "#bec0c8",
      borderRadius: "50%",
    },
    "@media (max-width: 980px)": {
      maxWidth: "22rem",
      padding: "0 0 0 3rem",
    },
  },
});

function StepItem({
  number,
  title,
  numberVariant,
  children,
}: {
  number: number;
  title: string;
  numberVariant?: StyleXStyles<{ backgroundColor?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li {...stylex.props(styles.stepItem)}>
      <span {...stylex.props(styles.stepNumber, numberVariant ?? null)}>{number}</span>
      <div>
        <h3 {...stylex.props(styles.stepTitle)}>{title}</h3>
        <p {...stylex.props(styles.stepText)}>{children}</p>
      </div>
    </li>
  );
}

export function HowItWorks() {
  return (
    <section {...stylex.props(styles.howItWorks)} id="how-it-works">
      <div {...stylex.props(styles.sectionCopy)}>
        <span {...stylex.props(styles.kicker)}>HOW IT WORKS</span>
        <h2 {...stylex.props(styles.sectionTitle)}>感想がつなぐ、音楽との出会い。</h2>
        <ol {...stylex.props(styles.steps)}>
          <StepItem number={1} title="短い言葉で、感想をシェア">
            楽曲を聴いて浮かんだ気持ちや情景を、短い言葉で気軽に投稿できます。
          </StepItem>
          <StepItem
            number={2}
            title="誰かの言葉から、曲に出会う"
            numberVariant={styles.stepNumber2}
          >
            他の人の感想を読んで、気になる曲を見つけて聴いてみる。そんな出会いが生まれます。
          </StepItem>
          <StepItem
            number={3}
            title="曲ごとに、言葉が積もっていく"
            numberVariant={styles.stepNumber3}
          >
            一つの楽曲に、いろんな人のいろんな言葉が集まり、その曲の新しい一面が見えてきます。
          </StepItem>
        </ol>
      </div>
      <PhoneMock />
      <p {...stylex.props(styles.sideStatement)}>Words create new music experiences.</p>
    </section>
  );
}
