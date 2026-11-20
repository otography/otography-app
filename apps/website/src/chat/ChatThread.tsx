import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Me } from "#/lib/auth";
import { type AppleSong, artworkUrl, catalogSongsQuery } from "#/lib/musickit";
import { type PostView, similarPostsQuery } from "#/lib/posts";
import { motion } from "#/motion.stylex";
import { PreviewToggle } from "#/songs/PreviewToggle";
import { useChat } from "./ChatContext";
import { MusicNoteIcon } from "./icons";
import { chatMedia, chatTokens as t } from "./tokens.stylex";

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

function SongCard({ song }: { song: AppleSong }) {
  const { name, artistName, artwork } = song.attributes;

  return (
    <div {...stylex.props(styles.songCard)}>
      {artwork ? (
        <img
          src={artworkUrl(artwork.url, 96)}
          alt=""
          width={44}
          height={44}
          {...stylex.props(styles.songCardArt)}
        />
      ) : (
        <div {...stylex.props(styles.songCardArt, styles.artFallback)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
      )}
      <div {...stylex.props(styles.songCardMeta)}>
        <span {...stylex.props(styles.songCardTitle)}>{name}</span>
        <span {...stylex.props(styles.songCardArtist)}>{artistName}</span>
      </div>
      <PreviewToggle song={song} title={name} style={styles.iconBtn} />
    </div>
  );
}

function UserTurnMessage({ user, song, content }: { user: Me; song: AppleSong; content: string }) {
  const articleRef = useRef<HTMLElement | null>(null);

  // 投稿直後のユーザーメッセージを、画面下のコンポーザー位置から定位置まで滑らかに上昇させる（FLIP / WAAPI）。
  useLayoutEffect(() => {
    const el = articleRef.current;
    if (!el || typeof el.animate !== "function") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: "ease",
      });
      return () => animation.cancel();
    }

    const rect = el.getBoundingClientRect();
    const composerRect = document.querySelector("[data-chat-composer]")?.getBoundingClientRect();
    const rawDelta = composerRect ? composerRect.top - rect.top : 40;
    const deltaY = Math.max(24, Math.min(rawDelta, window.innerHeight * 0.65));
    const duration = Math.round(Math.min(420, Math.max(240, 200 + deltaY * 0.42)));

    const animation = el.animate(
      [
        { opacity: 0, transform: `translateY(${deltaY}px) scale(0.96)`, offset: 0 },
        { opacity: 1, transform: `translateY(${deltaY * 0.35}px) scale(0.99)`, offset: 0.35 },
        { opacity: 1, transform: "translateY(0) scale(1)", offset: 1 },
      ],
      {
        duration,
        easing: motion.easeOut,
      },
    );
    return () => animation.cancel();
  }, []);

  return (
    <article ref={articleRef} {...stylex.props(styles.turn, styles.turnUser)}>
      <div {...stylex.props(styles.userBubble)}>
        <SongCard song={song} />
        <p {...stylex.props(styles.userText)}>{content}</p>
      </div>
      <Avatar {...stylex.props(styles.avatar)}>
        {user.image ? (
          <AvatarImage
            src={user.image}
            alt={user.name}
            referrerPolicy="no-referrer"
            {...stylex.props(styles.avatarImg)}
          />
        ) : null}
        <AvatarFallback>
          <span aria-hidden="true">{initials(user.name)}</span>
          <span data-slot="visually-hidden">{user.name}</span>
        </AvatarFallback>
      </Avatar>
    </article>
  );
}

function SimilarPostCard({
  post,
  catalogSong,
  index,
}: {
  post: PostView;
  catalogSong?: AppleSong;
  index: number;
}) {
  const staggerStyle =
    index === 0
      ? styles.stagger0
      : index === 1
        ? styles.stagger1
        : index === 2
          ? styles.stagger2
          : styles.stagger3;

  return (
    <article {...stylex.props(styles.similarCard, styles.similarCardEnter, staggerStyle)}>
      {post.song ? (
        <div {...stylex.props(styles.similarSong)}>
          {post.song.artworkUrl ? (
            <img
              src={artworkUrl(post.song.artworkUrl, 96)}
              alt=""
              width={40}
              height={40}
              {...stylex.props(styles.similarArt)}
            />
          ) : (
            <div {...stylex.props(styles.similarArt, styles.artFallback)} aria-hidden="true">
              <MusicNoteIcon />
            </div>
          )}
          <div {...stylex.props(styles.similarSongMeta)}>
            {post.song.url ? (
              <a
                href={post.song.url}
                target="_blank"
                rel="noreferrer"
                {...stylex.props(styles.similarTitle, styles.similarTitleLink)}
              >
                {post.song.title ?? "（曲名なし）"}
              </a>
            ) : (
              <span {...stylex.props(styles.similarTitle)}>
                {post.song.title ?? "（曲名なし）"}
              </span>
            )}
            {post.song.artistName ? (
              <span {...stylex.props(styles.similarArtist)}>{post.song.artistName}</span>
            ) : null}
          </div>
          {catalogSong ? (
            <PreviewToggle
              style={styles.iconBtn}
              song={catalogSong}
              title={post.song.title ?? catalogSong.attributes.name}
            />
          ) : null}
        </div>
      ) : null}
      <p {...stylex.props(styles.similarQuote)}>{post.content}</p>
      <div {...stylex.props(styles.similarAuthor)}>
        <Avatar {...stylex.props(styles.avatarSm)}>
          {post.author.image ? (
            <AvatarImage
              src={post.author.image}
              alt={post.author.name}
              referrerPolicy="no-referrer"
              {...stylex.props(styles.avatarImg)}
            />
          ) : null}
          <AvatarFallback>
            <span aria-hidden="true">{initials(post.author.name)}</span>
            <span data-slot="visually-hidden">{post.author.name}</span>
          </AvatarFallback>
        </Avatar>
        <span>{post.author.name}</span>
      </div>
    </article>
  );
}

function AssistantSimilarReply({ postId, songTitle }: { postId: string; songTitle: string }) {
  const [includeSameSong, setIncludeSameSong] = useState(false);
  const query = useQuery(similarPostsQuery(postId, includeSameSong));
  const songIds = useMemo(
    () =>
      (query.data ?? [])
        .map((post) => post.song?.appleSongId)
        .filter((id): id is string => Boolean(id)),
    [query.data],
  );
  const catalogQuery = useQuery(catalogSongsQuery(songIds));
  const catalogSongs = useMemo(() => {
    const byId = new Map<string, AppleSong>();
    const byIsrc = new Map<string, AppleSong>();
    for (const song of catalogQuery.data ?? []) {
      byId.set(song.id, song);
      if (song.attributes.isrc) {
        byIsrc.set(song.attributes.isrc.toUpperCase(), song);
      }
    }
    return { byId, byIsrc };
  }, [catalogQuery.data]);

  return (
    <article {...stylex.props(styles.turn, styles.turnAssistant, styles.turnAssistantEnter)}>
      <img
        src="/otography-icon.png"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        {...stylex.props(styles.botBadge)}
      />
      <div {...stylex.props(styles.assistantBody)}>
        <div {...stylex.props(styles.assistantHeader)}>
          <p {...stylex.props(styles.assistantLead)}>
            「{songTitle}」の感想を投稿しました。
            {query.isPending
              ? "近い感覚の曲を探しています…"
              : query.data && query.data.length > 0
                ? "似た感覚の感想が見つかりました。"
                : "まだ近い感想は見つかりませんでした。"}
          </p>
          <Toggle
            {...stylex.props(styles.filterToggle, includeSameSong && styles.filterTogglePressed)}
            pressed={includeSameSong}
            onPressedChange={setIncludeSameSong}
          >
            同じ曲も含める
          </Toggle>
        </div>

        {query.isError ? (
          <p role="alert" {...stylex.props(styles.errorText)}>
            {query.error.message}
          </p>
        ) : null}

        {query.data && query.data.length > 0 ? (
          <div {...stylex.props(styles.similarList)}>
            {query.data.map((post, index) => {
              const catalogSong = post.song
                ? (catalogSongs.byId.get(post.song.appleSongId) ??
                  catalogSongs.byIsrc.get(post.song.isrc.toUpperCase()))
                : undefined;
              return (
                <SimilarPostCard
                  key={post.id}
                  post={post}
                  catalogSong={catalogSong}
                  index={index}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AssistantErrorReply({ message }: { message: string }) {
  return (
    <article {...stylex.props(styles.turn, styles.turnAssistant, styles.turnAssistantEnter)}>
      <img
        src="/otography-icon.png"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        {...stylex.props(styles.botBadge)}
      />
      <div {...stylex.props(styles.assistantBody)}>
        <p role="alert" {...stylex.props(styles.errorText)}>
          投稿できませんでした: {message}
        </p>
      </div>
    </article>
  );
}

export function ChatThread({ user }: { user: Me }) {
  const { state, actions } = useChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [state.turns.length]);

  if (state.turns.length === 0) {
    return (
      <section {...stylex.props(styles.welcome)} aria-label="はじめる">
        <div {...stylex.props(styles.welcomeIcon)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
        <h1 {...stylex.props(styles.welcomeTitle)}>どの曲の感想を残しますか？</h1>
        <p {...stylex.props(styles.welcomeDesc, styles.welcomeDescDesktop)}>
          入力欄で <code {...stylex.props(styles.inlineCode)}>@</code> または{" "}
          <code {...stylex.props(styles.inlineCode)}>/</code>{" "}
          を押して曲を検索し、感想を送ると近い感覚の曲が返ってきます。
        </p>
        <p {...stylex.props(styles.welcomeDesc, styles.welcomeDescMobile)}>
          曲を選んで感想を送ると、近い感覚の曲が返ってきます。
        </p>
        <div {...stylex.props(styles.welcomeActions)}>
          <Button
            type="button"
            {...stylex.props(styles.suggestionPill)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => actions.openSongSearch("@")}
          >
            @ で曲を検索する
          </Button>
          <Button
            type="button"
            {...stylex.props(styles.suggestionPill)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => actions.openSongSearch("/")}
          >
            / で曲を検索する
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div {...stylex.props(styles.thread)} aria-live="polite">
      {state.turns.map((turn) => {
        if (turn.kind === "user") {
          return (
            <UserTurnMessage key={turn.id} user={user} song={turn.song} content={turn.content} />
          );
        }
        if (turn.kind === "assistant") {
          return (
            <AssistantSimilarReply key={turn.id} postId={turn.postId} songTitle={turn.songTitle} />
          );
        }
        return <AssistantErrorReply key={turn.id} message={turn.message} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}

const turnEnter = stylex.keyframes({
  from: {
    opacity: 0,
    transform: "translateY(10px)",
  },
  to: {
    opacity: 1,
    transform: "translateY(0)",
  },
});

const similarCardEnter = stylex.keyframes({
  from: {
    opacity: 0,
    transform: "translateY(8px) scale(0.985)",
  },
  to: {
    opacity: 1,
    transform: "translateY(0) scale(1)",
  },
});

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  welcome: {
    display: "flex",
    flexDirection: "column",
    gap: {
      default: 14,
      [chatMedia.compact]: 10,
    },
    alignItems: "center",
    paddingBlock: {
      default: 40,
      [chatMedia.compact]: 16,
    },
    paddingInline: 12,
    marginBlock: "auto",
    marginInline: 0,
    textAlign: "center",
  },
  welcomeIcon: {
    display: "grid",
    placeItems: "center",
    width: {
      default: 44,
      [chatMedia.compact]: 36,
    },
    height: {
      default: 44,
      [chatMedia.compact]: 36,
    },
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: {
      default: 12,
      [chatMedia.compact]: 10,
    },
  },
  welcomeTitle: {
    margin: 0,
    fontSize: {
      default: "clamp(22px, 3vw, 28px)",
      [chatMedia.compact]: 20,
    },
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  welcomeDesc: {
    maxWidth: 480,
    margin: 0,
    fontSize: {
      default: 14,
      [chatMedia.compact]: 13,
    },
    lineHeight: 1.65,
    color: t.muted,
  },
  welcomeDescDesktop: {
    display: {
      default: "block",
      [chatMedia.compact]: "none",
    },
  },
  welcomeDescMobile: {
    display: {
      default: "none",
      [chatMedia.compact]: "block",
    },
  },
  inlineCode: {
    paddingBlock: 1,
    paddingInline: 6,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
  },
  welcomeActions: {
    display: {
      default: "flex",
      [chatMedia.compact]: "none",
    },
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 6,
  },
  suggestionPill: {
    height: 34,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: t.surface,
      ":hover": {
        default: t.surface,
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: {
      default: t.border,
      ":hover": {
        default: t.border,
        [chatMedia.hover]: t.borderStrong,
      },
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}, border-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, border-color 120ms ease",
    },
  },
  thread: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  turn: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  turnUser: {
    justifyContent: "flex-end",
  },
  turnAssistant: {
    justifyContent: "flex-start",
  },
  turnAssistantEnter: {
    animationName: {
      default: turnEnter,
      [chatMedia.reducedMotion]: fadeIn,
    },
    animationDuration: {
      default: "220ms",
      [chatMedia.reducedMotion]: "150ms",
    },
    animationTimingFunction: {
      default: motion.easeOut,
      [chatMedia.reducedMotion]: "ease",
    },
    animationFillMode: "both",
  },
  avatar: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    overflow: "hidden",
    fontSize: 12,
    borderRadius: 9999,
  },
  avatarSm: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    overflow: "hidden",
    fontSize: 11,
    borderRadius: 9999,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  botBadge: {
    display: "block",
    flexShrink: 0,
    width: 32,
    height: 32,
    objectFit: "cover",
    borderRadius: 9,
  },
  userBubble: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: "min(100%, 540px)",
    paddingBlock: 12,
    paddingInline: 14,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
  },
  userText: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  songCard: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    paddingBlock: 8,
    paddingInline: 10,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  songCardArt: {
    flexShrink: 0,
    width: 44,
    height: 44,
    objectFit: "cover",
    borderRadius: 8,
  },
  songCardMeta: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  songCardTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  songCardArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 28,
    height: 28,
    padding: 0,
    color: {
      default: t.muted,
      ":hover": {
        default: t.muted,
        [chatMedia.hover]: t.text,
      },
    },
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}, color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  assistantBody: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    paddingTop: 4,
  },
  assistantHeader: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  assistantLead: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
  },
  filterToggle: {
    height: 28,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 500,
    color: t.muted,
    cursor: "pointer",
    backgroundColor: "transparent",
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}, color 150ms ${motion.easeOut}, border-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]:
        "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
    },
  },
  filterTogglePressed: {
    color: t.primaryFg,
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  similarList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  similarCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 14,
  },
  similarCardEnter: {
    animationName: {
      default: similarCardEnter,
      [chatMedia.reducedMotion]: fadeIn,
    },
    animationDuration: {
      default: "220ms",
      [chatMedia.reducedMotion]: "150ms",
    },
    animationTimingFunction: {
      default: motion.easeOut,
      [chatMedia.reducedMotion]: "ease",
    },
    animationFillMode: "both",
  },
  stagger0: {
    animationDelay: "0ms",
  },
  stagger1: {
    animationDelay: {
      default: "50ms",
      [chatMedia.reducedMotion]: "0ms",
    },
  },
  stagger2: {
    animationDelay: {
      default: "90ms",
      [chatMedia.reducedMotion]: "0ms",
    },
  },
  stagger3: {
    animationDelay: {
      default: "120ms",
      [chatMedia.reducedMotion]: "0ms",
    },
  },
  similarSong: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  similarArt: {
    flexShrink: 0,
    width: 40,
    height: 40,
    objectFit: "cover",
    borderRadius: 8,
  },
  similarSongMeta: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  similarTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
    whiteSpace: "nowrap",
  },
  similarTitleLink: {
    textDecoration: {
      default: "none",
      ":hover": {
        default: "none",
        [chatMedia.hover]: "underline",
      },
    },
    opacity: {
      default: 1,
      ":active": 0.65,
    },
    transition: `opacity 120ms ${motion.easeOut}`,
  },
  similarArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  similarQuote: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  similarAuthor: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    color: t.muted,
  },
  errorText: {
    margin: 0,
    fontSize: 14,
    color: t.danger,
  },
});
