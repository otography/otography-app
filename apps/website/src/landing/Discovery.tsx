import * as stylex from "@stylexjs/stylex";
import { BudouxText } from "./BudouxText";
import { Avatar } from "./Avatar";
import { fontTokens } from "./tokens.stylex";
import { TrackArt, type ArtVariant } from "./TrackArt";

const styles = stylex.create({
  discovery: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(15rem, 0.72fr) minmax(0, 1.9fr)",
      "@media (max-width: 980px)": "1fr",
    },
    gap: "clamp(2rem, 4vw, 3.5rem)",
    alignItems: "start",
    width: "min(100%, 78rem)",
    padding: "clamp(3rem, 6vw, 4.5rem) clamp(1.25rem, 3vw, 2.5rem)",
    paddingInline: {
      default: null,
      "@media (max-width: 640px)": "1rem",
    },
    margin: "0 auto",
  },
  discoveryIntro: {
    display: "grid",
    gap: "1.25rem",
    alignContent: "start",
  },
  kicker: {
    fontFamily: fontTokens.mono,
    fontSize: "0.84rem",
    fontWeight: 760,
    color: "#8177ec",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    fontFamily: fontTokens.heading,
    fontSize: "clamp(2rem, 4vw, 2.75rem)",
    fontWeight: 700,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  discoveryIntroText: {
    maxWidth: "19rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "0.98rem",
    fontWeight: 400,
    lineHeight: 1.95,
    color: "#2b303d",
  },
  discoveryLink: {
    display: "inline-flex",
    gap: "0.8rem",
    alignItems: "center",
    width: "fit-content",
    marginTop: "1rem",
    fontFamily: fontTokens.body,
    fontSize: "0.9rem",
    fontWeight: 700,
    color: {
      default: "#8177ec",
      ":hover": "#6f64e8",
    },
  },
  discoveryGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(4, minmax(0, 1fr))",
      "@media (max-width: 640px)": "1fr",
      "@media (min-width: 641px) and (max-width: 980px)": "repeat(2, minmax(0, 1fr))",
    },
    gap: "clamp(2.5rem, 5vw, 3.5rem) clamp(1rem, 2vw, 2rem)",
  },
  discoveryCard: {
    display: "grid",
    gap: "0.7rem",
    minWidth: 0,
  },
  discoveryArt: {
    width: "100%",
    height: "auto",
    aspectRatio: "1",
  },
  discoveryCardTitle: {
    minHeight: "1.3rem",
    paddingInline: "0.25rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "0.92rem",
    fontWeight: 700,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  discoveryCardArtist: {
    paddingInline: "0.25rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "0.78rem",
    fontWeight: 500,
    lineHeight: 1.35,
    color: "#4d5360",
  },
  discoveryMeta: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto auto",
    gap: "0.48rem",
    alignItems: "center",
    minHeight: "1.9rem",
    paddingInline: "0.25rem",
    fontFamily: fontTokens.body,
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#4f5663",
  },
  discoveryAvatar: {
    width: "1.45rem",
    height: "1.45rem",
    fontSize: "0.62rem",
  },
  heartIcon: {
    color: "#f08a9a",
  },
  discoveryCardQuote: {
    paddingInline: "0.25rem",
    margin: 0,
    fontFamily: fontTokens.body,
    fontSize: "0.92rem",
    fontWeight: 500,
    lineHeight: 1.75,
    color: "#202633",
    letterSpacing: "0.04em",
  },
});

const discoveryItems: Array<{
  artVariant: ArtVariant;
  title: string;
  artist: string;
  user: string;
  likes: number;
  quote: string;
}> = [
  {
    artVariant: "dusk",
    title: "夜を偉いはたして",
    artist: "Lucky Kilimanjaro",
    user: "あおい",
    likes: 24,
    quote: "終電後の静けさがちょうどいい。",
  },
  {
    artVariant: "window",
    title: "ミラー",
    artist: "須田景凪",
    user: "しほ",
    likes: 31,
    quote: "過去の自分に会いに行くみたい。",
  },
  {
    artVariant: "coast",
    title: "海の幽霊",
    artist: "ヨルシカ",
    user: "KANA",
    likes: 28,
    quote: "波の音と一緒に思い出がよみがえる。",
  },
  {
    artVariant: "room",
    title: "Nour",
    artist: "EGO-WRAPPIN'",
    user: "たいせい",
    likes: 19,
    quote: "休日の朝、部屋の静けさに合う。",
  },
];

function DiscoveryCard({
  artVariant,
  title,
  artist,
  user,
  likes,
  quote,
}: (typeof discoveryItems)[number]) {
  return (
    <article {...stylex.props(styles.discoveryCard)}>
      <TrackArt variant={artVariant} style={styles.discoveryArt} label={`${title} のジャケット`} />
      <h3 {...stylex.props(styles.discoveryCardTitle)}>{title}</h3>
      <p {...stylex.props(styles.discoveryCardArtist)}>{artist}</p>
      <div {...stylex.props(styles.discoveryMeta)}>
        <Avatar style={styles.discoveryAvatar}>{user.slice(0, 1)}</Avatar>
        <span>{user}</span>
        <span aria-hidden="true" {...stylex.props(styles.heartIcon)}>
          ♡
        </span>
        <span>{likes}</span>
      </div>
      <blockquote {...stylex.props(styles.discoveryCardQuote)}>
        <BudouxText text={quote} />
      </blockquote>
    </article>
  );
}

export function Discovery() {
  return (
    <section {...stylex.props(styles.discovery)} id="voices">
      <div {...stylex.props(styles.discoveryIntro)}>
        <span {...stylex.props(styles.kicker)}>DISCOVER</span>
        <h2 {...stylex.props(styles.sectionTitle)}>
          <BudouxText text="いろんな人の、いろんな聴き方。" />
        </h2>
        <p {...stylex.props(styles.discoveryIntroText)}>
          <BudouxText text="同じ曲でも、聴く人やタイミングで感じ方は違う。だからおもしろい。" />
        </p>
        <a href="#voices" {...stylex.props(styles.discoveryLink)}>
          <span>みんなの感想を見る</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <div {...stylex.props(styles.discoveryGrid)}>
        {discoveryItems.map((item) => (
          <DiscoveryCard key={item.title} {...item} />
        ))}
      </div>
    </section>
  );
}
