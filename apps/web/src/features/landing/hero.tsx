import Image from "next/image";
import * as stylex from "@stylexjs/stylex";
import { Avatar } from "./avatar";
import { MusicPill } from "./music-pill";
import { PrimaryLink } from "./primary-link";
import { fontBody, fontHeading } from "./tokens.stylex";
import type { ArtVariant } from "./track-art";

const styles = stylex.create({
  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(32rem, 1.1fr)",
    gap: "clamp(2rem, 5vw, 5rem)",
    alignItems: "center",
    width: "min(100%, 78rem)",
    minHeight: "clamp(41rem, 78svh, 48rem)",
    margin: "0 auto",
    padding: "clamp(2rem, 5vw, 4.5rem) clamp(1.25rem, 3vw, 2.5rem) 3rem",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr",
      minHeight: "auto",
      paddingTop: "2.5rem",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  heroCopy: {
    display: "grid",
    gap: "2rem",
    alignContent: "center",
    maxWidth: "31rem",
    "@media (max-width: 980px)": {
      maxWidth: "42rem",
    },
  },
  heroTitle: {
    position: "relative",
    width: "fit-content",
    fontFamily: fontHeading,
    fontSize: "clamp(4.4rem, 8vw, 6.5rem)",
    fontWeight: 800,
    lineHeight: 0.98,
    letterSpacing: 0,
    whiteSpace: "nowrap",
    margin: 0,
    "@media (max-width: 640px)": {
      fontSize: "clamp(3.2rem, 17vw, 4.5rem)",
    },
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
    fontFamily: fontBody,
    fontSize: "clamp(1.25rem, 2vw, 1.55rem)",
    fontWeight: 700,
    lineHeight: 1.85,
    letterSpacing: "0.12em",
    "@media (max-width: 640px)": {
      fontSize: "1.08rem",
      letterSpacing: "0.06em",
    },
  },
  heroDescription: {
    maxWidth: "28rem",
    margin: 0,
    color: "#242936",
    fontFamily: fontBody,
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 2,
    letterSpacing: "0.05em",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1.5rem",
    alignItems: "center",
    paddingTop: "0.8rem",
    "@media (max-width: 640px)": {
      alignItems: "stretch",
    },
  },
  heroActionPrimaryLink: {
    "@media (max-width: 640px)": {
      width: "100%",
    },
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.9rem",
    minHeight: "3.25rem",
    whiteSpace: "nowrap",
    fontFamily: fontBody,
    fontSize: "0.95rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    minWidth: "9.5rem",
    color: "#1e2431",
    ":hover": {
      color: "#6f64e8",
    },
    "@media (max-width: 640px)": {
      width: "100%",
    },
  },
  heroVisual: {
    position: "relative",
    minHeight: "clamp(34rem, 56vw, 43rem)",
    "@media (max-width: 980px)": {
      minHeight: "35rem",
    },
    "@media (max-width: 640px)": {
      minHeight: "44rem",
    },
  },
  heroAura: {
    position: "absolute",
    zIndex: 0,
    objectFit: "contain",
    pointerEvents: "none",
    userSelect: "none",
    top: {
      default: "-12rem",
      "@media (max-width: 640px)": "-7rem",
    },
    left: {
      default: "-3rem",
      "@media (max-width: 640px)": "-7rem",
    },
    width: {
      default: "100%",
      "@media (max-width: 640px)": "120%",
    },
    height: "auto",
    clipPath: "circle(26% at 50% 50%)",
  },
  heroDots: {
    position: "absolute",
    zIndex: 0,
    objectFit: "contain",
    pointerEvents: "none",
    userSelect: "none",
    right: "2.6rem",
    bottom: "5.2rem",
    width: "6rem",
    height: "auto",
    objectPosition: "50% 50%",
    "@media (max-width: 640px)": {
      right: "0.4rem",
      bottom: "-0.4rem",
      width: "7rem",
      height: "auto",
    },
  },
  heroOval: {
    position: "absolute",
    zIndex: 0,
    objectFit: "cover",
    pointerEvents: "none",
    userSelect: "none",
    top: "29%",
    left: "5%",
    width: "min(13.5rem, 25%)",
    height: "auto",
    clipPath: "ellipse(22% 32% at 50% 50%)",
    transform: "rotate(20deg)",
    "@media (max-width: 640px)": {
      top: "22rem",
      width: "6rem",
    },
  },
  heroScribble: {
    position: "absolute",
    zIndex: 0,
    objectFit: "cover",
    pointerEvents: "none",
    userSelect: "none",
    top: "11.7rem",
    right: "0.4rem",
    width: "min(18rem, 33%)",
    height: "auto",
    objectPosition: "center",
    "@media (max-width: 640px)": {
      top: "10.8rem",
      right: "-0.9rem",
      width: "13rem",
    },
  },
  heroPost: {
    position: "absolute",
    zIndex: 2,
    display: "grid",
    gap: "1rem",
    width: "min(19rem, 42vw)",
    minHeight: "11rem",
    padding: "1.25rem",
    backgroundColor: "rgba(255, 253, 247, 0.88)",
    border: "1px solid rgba(255, 255, 255, 0.74)",
    borderRadius: "1.25rem",
    boxShadow: "0 1.8rem 4.5rem rgba(38, 34, 23, 0.14)",
    backdropFilter: "blur(24px)",
    "@media (max-width: 640px)": {
      width: "min(19rem, calc(100vw - 2rem))",
    },
  },
  heroPostText: {
    margin: 0,
    fontFamily: fontBody,
    fontSize: "1.08rem",
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: "0.08em",
  },
  heroPostPrimary: {
    top: "5.5%",
    right: "15%",
    transform: "rotate(-2deg)",
    "@media (max-width: 640px)": {
      top: "1rem",
      left: "50%",
      right: "auto",
      transform: "translateX(-50%) rotate(-2deg)",
    },
  },
  heroPostSecondary: {
    right: "6%",
    bottom: "28%",
    backgroundColor: "rgba(229, 225, 255, 0.9)",
    transform: "rotate(4deg)",
    "@media (max-width: 640px)": {
      top: "14rem",
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translateX(-50%) rotate(4deg)",
    },
  },
  heroPostTertiary: {
    bottom: "3%",
    left: "1%",
    transform: "rotate(0deg)",
    "@media (max-width: 640px)": {
      top: "27rem",
      left: "50%",
      bottom: "auto",
      transform: "translateX(-50%) rotate(0deg)",
    },
  },
  postMeta: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: "0.55rem",
    alignItems: "center",
    color: "#4b5362",
    fontFamily: fontBody,
    fontSize: "0.78rem",
    fontWeight: 700,
  },
  postMetaTime: {
    color: "#9297a2",
    fontSize: "0.74rem",
    fontWeight: 500,
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
      <p {...stylex.props(styles.heroPostText)}>{text}</p>
      <MusicPill artVariant={artVariant} title={title} artist={artist} />
    </article>
  );
}

export function Hero({ ctaHref }: { ctaHref: string }) {
  return (
    <section {...stylex.props(styles.hero)} id="about">
      <div {...stylex.props(styles.heroCopy)}>
        <h1 aria-label="Music is passed on in words." {...stylex.props(styles.heroTitle)}>
          Music is
          <br />
          passed on
          <br />
          <Image
            alt=""
            aria-hidden="true"
            height={1024}
            priority
            src="/lp-asset-5-2.webp"
            width={1536}
            {...stylex.props(styles.inWordsImage)}
          />
        </h1>
        <p {...stylex.props(styles.heroLead)}>
          聴いた人の言葉をまとって、曲は次の誰かへ渡っていく。
        </p>
        <p {...stylex.props(styles.heroDescription)}>
          otographyは、楽曲への短い感想を投稿し、誰かの音楽体験に触れられるプラットフォームです。
        </p>
        <div {...stylex.props(styles.heroActions)}>
          <PrimaryLink href={ctaHref} style={styles.heroActionPrimaryLink} />
          <a href="#how-it-works" {...stylex.props(styles.secondaryLink)}>
            <span>もっと知る</span>
            <span aria-hidden="true">⌄</span>
          </a>
        </div>
      </div>
      <div {...stylex.props(styles.heroVisual)} aria-label="感想カードのプレビュー">
        <Image
          alt=""
          aria-hidden="true"
          height={1535}
          priority
          src="/lp-asset-4.webp"
          width={1535}
          {...stylex.props(styles.heroAura)}
        />
        <Image
          alt=""
          height={1024}
          priority
          src="/lp-asset-2.webp"
          width={1536}
          {...stylex.props(styles.heroDots)}
        />
        <Image
          alt=""
          aria-hidden="true"
          height={1024}
          priority
          src="/lp-asset-3.webp"
          width={1535}
          {...stylex.props(styles.heroOval)}
        />
        <Image
          alt=""
          aria-hidden="true"
          height={1254}
          priority
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
