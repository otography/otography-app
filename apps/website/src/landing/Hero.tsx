import * as stylex from "@stylexjs/stylex";
import { BudouxText } from "./BudouxText";
import { Avatar } from "./Avatar";
import { MusicPill } from "./MusicPill";
import { StartButton } from "./StartButton";
import { fontTokens } from "./tokens.stylex";
import type { ArtVariant } from "./TrackArt";

const styles = stylex.create({
  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 0.9fr) minmax(32rem, 1.1fr)",
      "@media (max-width: 980px)": "1fr",
    },
    gap: "clamp(2rem, 5vw, 5rem)",
    alignItems: "center",
    width: "min(100%, 78rem)",
    minHeight: {
      default: "clamp(41rem, 78svh, 48rem)",
      "@media (max-width: 980px)": "auto",
    },
    paddingInline: {
      default: "clamp(1.25rem, 3vw, 2.5rem)",
      "@media (max-width: 640px)": "1rem",
    },
    paddingTop: {
      default: "clamp(2rem, 5vw, 4.5rem)",
      "@media (max-width: 980px)": "2.5rem",
    },
    paddingBottom: "3rem",
    marginBlock: "0",
    marginInline: "auto",
  },
  heroCopy: {
    display: "grid",
    gap: "2rem",
    alignContent: "center",
    maxWidth: {
      default: "31rem",
      "@media (max-width: 980px)": "42rem",
    },
  },
  heroTitle: {
    position: "relative",
    width: "fit-content",
    margin: 0,
    fontFamily: fontTokens.heading,
    fontSize: {
      default: "clamp(4.4rem, 8vw, 6.5rem)",
      "@media (max-width: 640px)": "clamp(3.2rem, 17vw, 4.5rem)",
    },
    fontWeight: 800,
    lineHeight: 0.98,
    letterSpacing: 0,
    whiteSpace: "nowrap",
  },
  inWordsImage: {
    width: "100%",
    height: "auto",
    margin: 0,
    objectFit: "contain",
    objectPosition: "center",
  },
  heroLead: {
    maxWidth: "27rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: {
      default: "clamp(1.25rem, 2vw, 1.55rem)",
      "@media (max-width: 640px)": "1.08rem",
    },
    fontWeight: 700,
    lineHeight: 1.85,
    letterSpacing: {
      default: "0.12em",
      "@media (max-width: 640px)": "0.06em",
    },
  },
  heroDescription: {
    maxWidth: "28rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 2,
    color: "#242936",
    letterSpacing: "0.05em",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1.5rem",
    alignItems: {
      default: "center",
      "@media (max-width: 640px)": "stretch",
    },
    paddingTop: "0.8rem",
  },
  heroActionPrimaryLink: {
    width: {
      default: null,
      "@media (max-width: 640px)": "100%",
    },
  },
  secondaryLink: {
    display: "inline-flex",
    gap: "0.9rem",
    alignItems: "center",
    justifyContent: "center",
    width: {
      default: null,
      "@media (max-width: 640px)": "100%",
    },
    minWidth: "9.5rem",
    minHeight: "3.25rem",
    fontFamily: fontTokens.body,
    fontSize: "0.95rem",
    fontWeight: 700,
    color: {
      default: "#1e2431",
      ":hover": "#6f64e8",
    },
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  heroVisual: {
    position: "relative",
    minHeight: {
      default: "clamp(34rem, 56vw, 43rem)",
      "@media (max-width: 640px)": "44rem",
      "@media (min-width: 641px) and (max-width: 980px)": "35rem",
    },
  },
  heroAura: {
    position: "absolute",
    top: {
      default: "-12rem",
      "@media (max-width: 640px)": "-7rem",
    },
    left: {
      default: "-3rem",
      "@media (max-width: 640px)": "-7rem",
    },
    zIndex: 0,
    width: {
      default: "100%",
      "@media (max-width: 640px)": "120%",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
    objectFit: "contain",
    clipPath: "circle(26% at 50% 50%)",
  },
  heroDots: {
    position: "absolute",
    right: {
      default: "2.6rem",
      "@media (max-width: 640px)": "0.4rem",
    },
    bottom: {
      default: "5.2rem",
      "@media (max-width: 640px)": "-0.4rem",
    },
    zIndex: 0,
    width: {
      default: "6rem",
      "@media (max-width: 640px)": "7rem",
    },
    height: {
      default: "auto",
      "@media (max-width: 640px)": "auto",
    },
    pointerEvents: "none",
    userSelect: "none",
    objectFit: "contain",
    objectPosition: "50% 50%",
  },
  heroOval: {
    position: "absolute",
    top: {
      default: "29%",
      "@media (max-width: 640px)": "22rem",
    },
    left: "5%",
    zIndex: 0,
    width: {
      default: "min(13.5rem, 25%)",
      "@media (max-width: 640px)": "6rem",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
    objectFit: "cover",
    clipPath: "ellipse(22% 32% at 50% 50%)",
    transform: "rotate(20deg)",
  },
  heroScribble: {
    position: "absolute",
    top: {
      default: "11.7rem",
      "@media (max-width: 640px)": "10.8rem",
    },
    right: {
      default: "0.4rem",
      "@media (max-width: 640px)": "-0.9rem",
    },
    zIndex: 0,
    width: {
      default: "min(18rem, 33%)",
      "@media (max-width: 640px)": "13rem",
    },
    height: "auto",
    pointerEvents: "none",
    userSelect: "none",
    objectFit: "cover",
    objectPosition: "center",
  },
  heroPost: {
    position: "absolute",
    zIndex: 2,
    display: "grid",
    gap: "1rem",
    width: {
      default: "min(19rem, 42vw)",
      "@media (max-width: 640px)": "min(19rem, calc(100vw - 2rem))",
    },
    minHeight: "11rem",
    padding: "1.25rem",
    backgroundColor: "rgba(255, 253, 247, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.74)",
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: "1.25rem",
    boxShadow: "0 1.8rem 4.5rem rgba(38, 34, 23, 0.14)",
    backdropFilter: "blur(24px)",
  },
  heroPostText: {
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "1.08rem",
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: "0.08em",
  },
  heroPostPrimary: {
    top: {
      default: "5.5%",
      "@media (max-width: 640px)": "1rem",
    },
    right: {
      default: "15%",
      "@media (max-width: 640px)": "auto",
    },
    left: {
      default: null,
      "@media (max-width: 640px)": "50%",
    },
    transform: {
      default: "rotate(-2deg)",
      "@media (max-width: 640px)": "translateX(-50%) rotate(-2deg)",
    },
  },
  heroPostSecondary: {
    top: {
      default: null,
      "@media (max-width: 640px)": "14rem",
    },
    right: {
      default: "6%",
      "@media (max-width: 640px)": "auto",
    },
    bottom: {
      default: "28%",
      "@media (max-width: 640px)": "auto",
    },
    left: {
      default: null,
      "@media (max-width: 640px)": "50%",
    },
    backgroundColor: "rgba(229, 225, 255, 0.9)",
    transform: {
      default: "rotate(4deg)",
      "@media (max-width: 640px)": "translateX(-50%) rotate(4deg)",
    },
  },
  heroPostTertiary: {
    top: {
      default: null,
      "@media (max-width: 640px)": "27rem",
    },
    bottom: {
      default: "3%",
      "@media (max-width: 640px)": "auto",
    },
    left: {
      default: "1%",
      "@media (max-width: 640px)": "50%",
    },
    transform: {
      default: "rotate(0deg)",
      "@media (max-width: 640px)": "translateX(-50%) rotate(0deg)",
    },
  },
  postMeta: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: "0.55rem",
    alignItems: "center",
    fontFamily: fontTokens.body,
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#4b5362",
  },
  postMetaTime: {
    fontSize: "0.74rem",
    fontWeight: 500,
    color: "#9297a2",
  },
});

const heroPosts: Array<{
  positionStyle: keyof Pick<
    typeof styles,
    "heroPostPrimary" | "heroPostSecondary" | "heroPostTertiary"
  >;
  name: string;
  time: string;
  text: string;
  artVariant: ArtVariant;
  title: string;
  artist: string;
}> = [
  {
    positionStyle: "heroPostPrimary",
    name: "Aoi",
    time: "2m ago",
    text: "夜の帰り道、風がちょっと優しくなる曲。",
    artVariant: "coast",
    title: "lights",
    artist: "Tempalay",
  },
  {
    positionStyle: "heroPostSecondary",
    name: "haru",
    time: "1h ago",
    text: "雨の匂いがする朝にぴったり。",
    artVariant: "forest",
    title: "Lighthouse",
    artist: "haruka nakamura",
  },
  {
    positionStyle: "heroPostTertiary",
    name: "Yuuki",
    time: "3h ago",
    text: "何も考えたくない日にずっとリピートしてる。",
    artVariant: "pastel",
    title: "スローモーション",
    artist: "betcover!!",
  },
];

function HeroPostCard({
  positionStyle,
  name,
  time,
  text,
  artVariant,
  title,
  artist,
}: (typeof heroPosts)[number]) {
  return (
    <article {...stylex.props(styles.heroPost, styles[positionStyle])}>
      <div {...stylex.props(styles.postMeta)}>
        <Avatar>{name.slice(0, 1)}</Avatar>
        <span>{name}</span>
        <time {...stylex.props(styles.postMetaTime)}>{time}</time>
      </div>
      <p {...stylex.props(styles.heroPostText)}>
        <BudouxText text={text} />
      </p>
      <MusicPill artVariant={artVariant} title={title} artist={artist} />
    </article>
  );
}

export function Hero() {
  return (
    <section {...stylex.props(styles.hero)} id="about">
      <div {...stylex.props(styles.heroCopy)}>
        <h1 aria-label="Music is passed on in words." {...stylex.props(styles.heroTitle)}>
          Music is
          <br />
          passed on
          <br />
          <img
            alt=""
            aria-hidden="true"
            height={1024}
            fetchPriority="high"
            src="/lp-asset-5-2.webp"
            width={1536}
            {...stylex.props(styles.inWordsImage)}
          />
        </h1>
        <p {...stylex.props(styles.heroLead)}>
          <BudouxText text="聴いた人の言葉をまとって、曲は次の誰かへ渡っていく。" />
        </p>
        <p {...stylex.props(styles.heroDescription)}>
          <BudouxText text="otographyは、楽曲への短い感想を投稿し、誰かの音楽体験に触れられるプラットフォームです。" />
        </p>
        <div {...stylex.props(styles.heroActions)}>
          <StartButton style={styles.heroActionPrimaryLink} />
          <a href="#how-it-works" {...stylex.props(styles.secondaryLink)}>
            <span>もっと知る</span>
            <span aria-hidden="true">⌄</span>
          </a>
        </div>
      </div>
      <div {...stylex.props(styles.heroVisual)} aria-label="感想カードのプレビュー">
        <img
          alt=""
          aria-hidden="true"
          height={1535}
          fetchPriority="high"
          src="/lp-asset-4.webp"
          width={1535}
          {...stylex.props(styles.heroAura)}
        />
        <img
          alt=""
          height={1024}
          fetchPriority="high"
          src="/lp-asset-2.webp"
          width={1536}
          {...stylex.props(styles.heroDots)}
        />
        <img
          alt=""
          aria-hidden="true"
          height={1024}
          fetchPriority="high"
          src="/lp-asset-3.webp"
          width={1535}
          {...stylex.props(styles.heroOval)}
        />
        <img
          alt=""
          aria-hidden="true"
          height={1254}
          fetchPriority="high"
          src="/lp-asset-1.webp"
          width={1254}
          {...stylex.props(styles.heroScribble)}
        />
        {heroPosts.map((post) => (
          <HeroPostCard key={post.name} {...post} />
        ))}
      </div>
    </section>
  );
}
