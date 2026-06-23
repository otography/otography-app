import * as stylex from "@stylexjs/stylex";
import { Avatar } from "./avatar";
import { TrackArt, type ArtVariant } from "./track-art";

const styles = stylex.create({
  discovery: {
    display: "grid",
    gridTemplateColumns: "minmax(15rem, 0.72fr) minmax(0, 1.9fr)",
    gap: "clamp(2rem, 4vw, 3.5rem)",
    alignItems: "start",
    width: "min(100%, 78rem)",
    margin: "0 auto",
    padding: "clamp(3rem, 6vw, 4.5rem) clamp(1.25rem, 3vw, 2.5rem)",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "1fr",
    },
    "@media (max-width: 640px)": {
      paddingInline: "1rem",
    },
  },
  discoveryIntro: {
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
  discoveryIntroText: {
    maxWidth: "19rem",
    margin: 0,
    color: "#2b303d",
    fontSize: "0.98rem",
    fontWeight: 520,
    lineHeight: 1.95,
  },
  discoveryLink: {
    display: "inline-flex",
    gap: "0.8rem",
    alignItems: "center",
    width: "fit-content",
    marginTop: "1rem",
    color: "#8177ec",
    fontSize: "0.9rem",
    fontWeight: 760,
    ":hover": {
      color: "#6f64e8",
    },
  },
  discoveryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "clamp(1rem, 2vw, 2rem)",
    "@media (max-width: 980px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (max-width: 640px)": {
      gridTemplateColumns: "1fr",
    },
  },
  discoveryCard: {
    display: "grid",
    gap: "0.7rem",
    minWidth: 0,
    "@media (max-width: 640px)": {
      gridTemplateColumns: "7rem 1fr",
      columnGap: "1rem",
      alignItems: "start",
    },
  },
  discoveryArt: {
    width: "100%",
    aspectRatio: "1",
    "@media (max-width: 640px)": {
      gridRow: "span 5",
    },
  },
  discoveryCardTitle: {
    minHeight: "1.3rem",
    overflowWrap: "anywhere",
    fontSize: "0.92rem",
    fontWeight: 760,
    lineHeight: 1.45,
    margin: 0,
  },
  discoveryCardArtist: {
    margin: 0,
    color: "#4d5360",
    fontSize: "0.78rem",
    fontWeight: 560,
    lineHeight: 1.35,
  },
  discoveryMeta: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto auto",
    gap: "0.48rem",
    alignItems: "center",
    minHeight: "1.9rem",
    color: "#4f5663",
    fontSize: "0.75rem",
    fontWeight: 650,
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
    margin: 0,
    color: "#202633",
    fontSize: "0.92rem",
    fontWeight: 560,
    lineHeight: 1.75,
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
      <blockquote {...stylex.props(styles.discoveryCardQuote)}>{quote}</blockquote>
    </article>
  );
}

export function Discovery() {
  return (
    <section {...stylex.props(styles.discovery)} id="voices">
      <div {...stylex.props(styles.discoveryIntro)}>
        <span {...stylex.props(styles.kicker)}>DISCOVER</span>
        <h2 {...stylex.props(styles.sectionTitle)}>いろんな人の、いろんな聴き方。</h2>
        <p {...stylex.props(styles.discoveryIntroText)}>
          同じ曲でも、聴く人やタイミングで感じ方は違う。だからおもしろい。
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
