import Image from "next/image";
import * as stylex from "@stylexjs/stylex";
import { landingTokens as t } from "./tokens.stylex";
import { Avatar } from "./avatar";
import { TrackArt, type ArtVariant } from "./track-art";

const styles = stylex.create({
  phoneMock: {
    position: "relative",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    width: "min(100%, 22.5rem)",
    minHeight: "31rem",
    padding: "1.35rem 1.45rem 1rem",
    overflow: "hidden",
    backgroundColor: "rgba(255, 253, 247, 0.9)",
    borderWidth: "0.55rem",
    borderStyle: "solid",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: "2.5rem",
    boxShadow: "inset 0 0 0 1px rgba(23, 27, 38, 0.06), 0 1.6rem 4rem rgba(64, 42, 89, 0.14)",
    justifySelf: "center",
    "@media (max-width: 980px)": {
      width: "min(100%, 24rem)",
    },
    "@media (max-width: 640px)": {
      minHeight: "29rem",
      padding: "1.1rem 1rem 0.7rem",
      borderWidth: "0.42rem",
      borderRadius: "2rem",
    },
  },
  phoneTexture: {
    position: "absolute",
    inset: "-6rem auto auto -9rem",
    zIndex: 0,
    width: "34rem",
    height: "auto",
    opacity: 0.34,
    pointerEvents: "none",
    transform: "scale(1.2)",
  },
  phoneHeader: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    alignItems: "center",
    minHeight: "2.4rem",
    color: "#686e7a",
    fontSize: "0.92rem",
  },
  phoneHeaderActive: {
    position: "relative",
    color: t.ink,
    "::after": {
      position: "absolute",
      bottom: "-0.6rem",
      left: 0,
      width: "2.15rem",
      height: "0.12rem",
      content: '""',
      backgroundColor: t.ink,
      borderRadius: "999px",
    },
  },
  phoneFeed: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    alignContent: "start",
    gap: "1.55rem",
    padding: "1.5rem 0",
  },
  feedPost: {
    display: "grid",
    gap: "0.85rem",
  },
  feedUser: {
    display: "flex",
    gap: "0.65rem",
    alignItems: "center",
  },
  feedUserName: {
    display: "block",
    lineHeight: 1.25,
    fontSize: "0.78rem",
  },
  feedUserTime: {
    display: "block",
    lineHeight: 1.25,
    color: "#878c96",
    fontSize: "0.72rem",
  },
  feedPostText: {
    margin: 0,
    paddingLeft: "2.4rem",
    fontSize: "0.98rem",
    fontWeight: 700,
    lineHeight: 1.7,
    letterSpacing: "0.04em",
    "@media (max-width: 640px)": {
      paddingLeft: 0,
    },
  },
  feedTrack: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: "0.72rem",
    alignItems: "center",
    marginLeft: "2.4rem",
    paddingTop: "0.55rem",
    paddingRight: "0.7rem",
    paddingBottom: "0.55rem",
    paddingLeft: "0.55rem",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: "0.45rem",
    boxShadow: "0 0.7rem 1.6rem rgba(23, 27, 38, 0.07)",
    "@media (max-width: 640px)": {
      marginLeft: 0,
      paddingLeft: 0,
    },
  },
  feedTrackArt: {
    width: "3.5rem",
    height: "3.5rem",
  },
  pillTitle: {
    display: "block",
    lineHeight: 1.35,
    fontSize: "0.78rem",
  },
  pillSubtitle: {
    display: "block",
    lineHeight: 1.35,
    color: "#5d6470",
    fontSize: "0.72rem",
  },
  feedPlayButton: {
    display: "grid",
    placeItems: "center",
    width: "2rem",
    height: "2rem",
    color: "#1f2430",
    fontSize: "0.75rem",
    backgroundColor: "#fff",
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "transparent",
    borderRadius: "50%",
    boxShadow: "0 0.45rem 1rem rgba(23, 27, 38, 0.1)",
  },
  phoneNav: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    alignItems: "center",
    minHeight: "3.4rem",
    color: "#11151f",
    fontSize: "1.35rem",
    textAlign: "center",
  },
  phoneNavAdd: {
    display: "grid",
    placeItems: "center",
    width: "2.7rem",
    height: "2.7rem",
    margin: "0 auto",
    color: "#fff",
    backgroundColor: "#151a24",
    borderRadius: "50%",
  },
});

const feedPosts: Array<{
  user: string;
  text: string;
  artVariant: ArtVariant;
  title: string;
  artist: string;
}> = [
  {
    user: "mio",
    text: "このベースライン、ずっと聴いていられる。",
    artVariant: "dusk",
    title: "Plastic Love",
    artist: "竹内まりや",
  },
  {
    user: "リョウ",
    text: "夕方の陽が沈む瞬間に聴きたくなる。",
    artVariant: "green",
    title: "The Door",
    artist: "iri",
  },
];

export function PhoneMock() {
  return (
    <div {...stylex.props(styles.phoneMock)}>
      <div {...stylex.props(styles.phoneHeader)}>
        <strong {...stylex.props(styles.phoneHeaderActive)}>For you</strong>
        <span>Following</span>
        <span aria-hidden="true">♢</span>
      </div>
      <div {...stylex.props(styles.phoneFeed)}>
        {feedPosts.map((post) => (
          <article key={post.title} {...stylex.props(styles.feedPost)}>
            <div {...stylex.props(styles.feedUser)}>
              <Avatar>{post.user.slice(0, 1)}</Avatar>
              <span>
                <strong {...stylex.props(styles.feedUserName)}>{post.user}</strong>
                <small {...stylex.props(styles.feedUserTime)}>5m ago</small>
              </span>
            </div>
            <p {...stylex.props(styles.feedPostText)}>{post.text}</p>
            <div {...stylex.props(styles.feedTrack)}>
              <TrackArt variant={post.artVariant} style={styles.feedTrackArt} />
              <span>
                <strong {...stylex.props(styles.pillTitle)}>{post.title}</strong>
                <small {...stylex.props(styles.pillSubtitle)}>{post.artist}</small>
              </span>
              <button aria-label={`${post.title} を再生`} {...stylex.props(styles.feedPlayButton)}>
                ▶
              </button>
            </div>
          </article>
        ))}
      </div>
      <nav aria-label="アプリ内ナビゲーション" {...stylex.props(styles.phoneNav)}>
        <span>⌂</span>
        <span>⌕</span>
        <span {...stylex.props(styles.phoneNavAdd)}>＋</span>
        <span>⌁</span>
        <span>♙</span>
      </nav>
      <Image
        alt="otography のフィード画面"
        height={1024}
        src="/lp-asset-4.webp"
        width={1535}
        {...stylex.props(styles.phoneTexture)}
      />
    </div>
  );
}
