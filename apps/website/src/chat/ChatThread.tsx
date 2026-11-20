import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import { useEffect, useRef, useState } from "react";
import type { Me } from "#/lib/auth";
import { type AppleSong, artworkUrl } from "#/lib/musickit";
import { type PostView, similarPostsQuery } from "#/lib/posts";
import { usePreviewPlayer } from "#/songs/preview-player";
import { useChat } from "./ChatContext";
import { MusicNoteIcon, PauseIcon, PlayIcon } from "./icons";
import { chatTokens as t } from "./tokens.stylex";

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

function SongCard({ song }: { song: AppleSong }) {
  const preview = usePreviewPlayer();
  const playing = preview.state.playingId === song.id;
  const { name, artistName, artwork, previews } = song.attributes;

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
      {previews?.length ? (
        <Button
          type="button"
          {...stylex.props(styles.iconBtn)}
          aria-label={playing ? `${name} の試聴を停止` : `${name} を試聴`}
          onClick={() => preview.actions.toggle(song)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      ) : null}
    </div>
  );
}

function UserTurnMessage({ user, song, content }: { user: Me; song: AppleSong; content: string }) {
  return (
    <article {...stylex.props(styles.turn, styles.turnUser)}>
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

function SimilarPostCard({ post }: { post: PostView }) {
  return (
    <article {...stylex.props(styles.similarCard)}>
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
  const toggleProps = stylex.props(styles.filterToggle);

  return (
    <article {...stylex.props(styles.turn, styles.turnAssistant)}>
      <div {...stylex.props(styles.botBadge)} aria-hidden="true">
        <MusicNoteIcon />
      </div>
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
            {...toggleProps}
            className={`chat-filter-toggle ${toggleProps.className ?? ""}`}
            pressed={includeSameSong}
            onPressedChange={setIncludeSameSong}
          >
            同じ曲も含める
          </Toggle>
        </div>

        {query.isPending ? (
          <div {...stylex.props(styles.skeletonList)} aria-busy="true">
            <div {...stylex.props(styles.skeletonCard)} />
            <div {...stylex.props(styles.skeletonCard)} />
          </div>
        ) : null}

        {query.isError ? (
          <p role="alert" {...stylex.props(styles.errorText)}>
            {query.error.message}
          </p>
        ) : null}

        {query.data && query.data.length > 0 ? (
          <div {...stylex.props(styles.similarList)}>
            {query.data.map((post) => (
              <SimilarPostCard key={post.id} post={post} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AssistantErrorReply({ message }: { message: string }) {
  return (
    <article {...stylex.props(styles.turn, styles.turnAssistant)}>
      <div {...stylex.props(styles.botBadge)} aria-hidden="true">
        <MusicNoteIcon />
      </div>
      <div {...stylex.props(styles.assistantBody)}>
        <p role="alert" {...stylex.props(styles.errorText)}>
          投稿できませんでした: {message}
        </p>
      </div>
    </article>
  );
}

export function ChatThread({ user }: { user: Me }) {
  const { state, meta } = useChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.turns.length]);

  if (state.turns.length === 0) {
    return (
      <section {...stylex.props(styles.welcome)} aria-label="はじめる">
        <div {...stylex.props(styles.welcomeIcon)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
        <h1 {...stylex.props(styles.welcomeTitle)}>どの曲の感想を残しますか？</h1>
        <p {...stylex.props(styles.welcomeDesc)}>
          入力欄で <code {...stylex.props(styles.inlineCode)}>@</code> または{" "}
          <code {...stylex.props(styles.inlineCode)}>/</code>{" "}
          を押して曲を検索し、感想を送ると近い感覚の曲が返ってきます。
        </p>
        <div {...stylex.props(styles.welcomeActions)}>
          <Button
            type="button"
            {...stylex.props(styles.suggestionPill)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void meta.menuController.open({ trigger: "@" })}
          >
            @ で曲を検索する
          </Button>
          <Button
            type="button"
            {...stylex.props(styles.suggestionPill)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void meta.menuController.open({ trigger: "/" })}
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

const pulse = stylex.keyframes({
  "0%": { opacity: 1 },
  "50%": { opacity: 0.5 },
  "100%": { opacity: 1 },
});

const styles = stylex.create({
  welcome: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "center",
    paddingBlock: 40,
    paddingInline: 12,
    marginBlock: "auto",
    marginInline: 0,
    textAlign: "center",
  },
  welcomeIcon: {
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
  },
  welcomeTitle: {
    margin: 0,
    fontSize: "clamp(22px, 3vw, 28px)",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  welcomeDesc: {
    maxWidth: 480,
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: t.muted,
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
    display: "flex",
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
      ":hover": t.hover,
    },
    borderColor: {
      default: t.border,
      ":hover": t.borderStrong,
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
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
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 32,
    height: 32,
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
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
      ":hover": t.text,
    },
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": t.hover,
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
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
      ":hover": "underline",
    },
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
  skeletonList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  skeletonCard: {
    height: 88,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 14,
    animationName: pulse,
    animationDuration: "1.5s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  errorText: {
    margin: 0,
    fontSize: 14,
    color: t.danger,
  },
});
