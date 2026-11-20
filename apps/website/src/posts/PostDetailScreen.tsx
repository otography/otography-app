import * as stylex from "@stylexjs/stylex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import { useEffect, useMemo, useState } from "react";
import { MusicNoteIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { meQuery } from "#/lib/auth";
import { authClient } from "#/lib/auth-client";
import { type AppleSong, artworkUrl, catalogSongsQuery } from "#/lib/musickit";
import { postQuery, type PostView, similarPostsQuery } from "#/lib/posts";
import { motion } from "#/motion.stylex";
import { ArrowLeftIcon } from "#/profile/icons";
import { AppShell } from "#/shell/AppShell";
import { MiniPlayerBar } from "#/songs/MiniPlayerBar";
import { usePreviewPlayer } from "#/songs/preview-player";
import { PreviewToggle } from "#/songs/PreviewToggle";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const expiresFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormatter.format(date);
}

function formatExpiresAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return expiresFormatter.format(date);
}

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

function SongRow({ post, catalogSong }: { post: PostView; catalogSong?: AppleSong }) {
  if (!post.song) return null;
  const title = post.song.title ?? "（曲名なし）";

  return (
    <div {...stylex.props(styles.songRow)}>
      {post.song.artworkUrl ? (
        <img
          src={artworkUrl(post.song.artworkUrl, 96)}
          alt=""
          width={44}
          height={44}
          {...stylex.props(styles.art)}
        />
      ) : (
        <div {...stylex.props(styles.art, styles.artFallback)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
      )}
      <div {...stylex.props(styles.songMeta)}>
        {post.song.url ? (
          <a
            href={post.song.url}
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.songTitle, styles.songTitleLink)}
          >
            {title}
          </a>
        ) : (
          <span {...stylex.props(styles.songTitle)}>{title}</span>
        )}
        {post.song.artistName ? (
          <span {...stylex.props(styles.songArtist)}>{post.song.artistName}</span>
        ) : null}
      </div>
      {catalogSong ? (
        <PreviewToggle song={catalogSong} title={title} style={styles.iconBtn} />
      ) : null}
    </div>
  );
}

function SimilarPostCard({ post, catalogSong }: { post: PostView; catalogSong?: AppleSong }) {
  return (
    <article {...stylex.props(styles.similarCard)}>
      <SongRow post={post} catalogSong={catalogSong} />
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

function PostDetailContent({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [includeSameSong, setIncludeSameSong] = useState(false);

  const postResult = useQuery(postQuery(postId));
  const similarResult = useQuery({
    ...similarPostsQuery(postId, includeSameSong),
    enabled: postResult.isSuccess,
  });

  const similarPosts = similarResult.data?.posts ?? [];
  const songIds = useMemo(() => {
    const ids: string[] = [];
    if (postResult.data?.song?.appleSongId) ids.push(postResult.data.song.appleSongId);
    for (const post of similarPosts) {
      if (post.song?.appleSongId) ids.push(post.song.appleSongId);
    }
    return ids;
  }, [postResult.data?.song?.appleSongId, similarPosts]);

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

  const lookupSong = (post: PostView) =>
    post.song
      ? (catalogSongs.byId.get(post.song.appleSongId) ??
        catalogSongs.byIsrc.get(post.song.isrc.toUpperCase()))
      : undefined;

  const player = usePreviewPlayer();
  const { preloadAppleMusic } = player.actions;

  useEffect(() => {
    preloadAppleMusic();
  }, [preloadAppleMusic]);

  const handleSignOut = () => {
    player.actions.close();
    void authClient.signOut().then(async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      await navigate({ to: "/" });
    });
  };

  return (
    <div {...stylex.props(styles.shell)}>
      <div {...stylex.props(styles.stickyHeader)}>
        <AppShell.Topbar>
          <div {...stylex.props(styles.leftNav)}>
            <Button render={<Link to="/" />} {...stylex.props(styles.backBtn)}>
              <ArrowLeftIcon />
              <span>ホーム</span>
            </Button>
            <Link to="/" {...stylex.props(styles.brand)}>
              <AppShell.BrandIcon />
              <AppShell.BrandName style={styles.brandName} />
            </Link>
          </div>

          <AppShell.SignOutButton onClick={handleSignOut} />
        </AppShell.Topbar>

        <MiniPlayerBar />
      </div>

      <main {...stylex.props(styles.main)}>
        <div {...stylex.props(styles.inner)}>
          {postResult.isPending ? (
            <div {...stylex.props(styles.stateBox)} aria-busy="true">
              投稿を読み込んでいます…
            </div>
          ) : postResult.isError ? (
            <div role="alert" {...stylex.props(styles.errorBox)}>
              <p {...stylex.props(styles.errorMessage)}>{postResult.error.message}</p>
              <Button render={<Link to="/" />} {...stylex.props(styles.errorAction)}>
                ホームに戻る
              </Button>
            </div>
          ) : (
            <>
              <section aria-label="あなたの投稿" {...stylex.props(styles.postCard)}>
                <SongRow post={postResult.data} catalogSong={lookupSong(postResult.data)} />
                <p {...stylex.props(styles.postContent)}>{postResult.data.content}</p>
                <footer {...stylex.props(styles.postFooter)}>
                  <time dateTime={postResult.data.createdAt} {...stylex.props(styles.timestamp)}>
                    {formatDateTime(postResult.data.createdAt)}
                  </time>
                </footer>
              </section>

              <section aria-labelledby="similar-section-heading" {...stylex.props(styles.section)}>
                <div {...stylex.props(styles.sectionHeader)}>
                  <div {...stylex.props(styles.sectionTitleGroup)}>
                    <h2 id="similar-section-heading" {...stylex.props(styles.sectionTitle)}>
                      近い感覚の曲
                    </h2>
                    {similarResult.data && !similarResult.data.expired ? (
                      <span {...stylex.props(styles.expiryHint)}>
                        {formatExpiresAt(similarResult.data.expiresAt)} まで閲覧可能
                      </span>
                    ) : null}
                  </div>
                  {similarResult.data && !similarResult.data.expired ? (
                    <Toggle
                      {...stylex.props(
                        styles.filterToggle,
                        includeSameSong && styles.filterTogglePressed,
                      )}
                      pressed={includeSameSong}
                      onPressedChange={setIncludeSameSong}
                    >
                      同じ曲も含める
                    </Toggle>
                  ) : null}
                </div>

                {similarResult.isPending ? (
                  <div {...stylex.props(styles.stateBox)} aria-busy="true">
                    検索結果を読み込んでいます…
                  </div>
                ) : similarResult.isError ? (
                  <p role="alert" {...stylex.props(styles.inlineError)}>
                    {similarResult.error.message}
                  </p>
                ) : similarResult.data?.expired ? (
                  <div {...stylex.props(styles.expiredCard)}>
                    <p {...stylex.props(styles.expiredTitle)}>
                      検索結果の閲覧期限（24時間）を過ぎました
                    </p>
                    <p {...stylex.props(styles.expiredDesc)}>
                      投稿した感想は引き続きいつでもこのページから見返せます。
                    </p>
                  </div>
                ) : similarPosts.length > 0 ? (
                  <div {...stylex.props(styles.similarList)}>
                    {similarPosts.map((post) => (
                      <SimilarPostCard key={post.id} post={post} catalogSong={lookupSong(post)} />
                    ))}
                  </div>
                ) : (
                  <div {...stylex.props(styles.expiredCard)}>
                    <p {...stylex.props(styles.expiredDesc)}>
                      まだ近い感覚の感想は見つかりませんでした。
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export function PostDetailScreen({ postId }: { postId: string }) {
  return <PostDetailContent postId={postId} />;
}

const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    color: t.text,
    colorScheme: "light dark",
    backgroundColor: t.bg,
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  leftNav: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    minWidth: 0,
  },
  backBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    textDecoration: "none",
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
    transition: `background-color 150ms ${motion.easeOut}`,
  },
  brand: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    color: "inherit",
    textDecoration: "none",
  },
  brandName: {
    display: {
      default: "inline",
      [chatMedia.compact]: "none",
    },
  },
  main: {
    flexGrow: 1,
    width: "100%",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    width: "min(100%, 720px)",
    paddingTop: {
      default: 28,
      [chatMedia.compact]: 16,
    },
    paddingRight: {
      default: 20,
      [chatMedia.compact]: 14,
    },
    paddingBottom: "max(48px, env(safe-area-inset-bottom, 0px))",
    paddingLeft: {
      default: 20,
      [chatMedia.compact]: 14,
    },
    marginBlock: 0,
    marginInline: "auto",
  },
  postCard: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
  },
  postContent: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.7,
    color: t.text,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  postFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 10,
    borderTopColor: t.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  timestamp: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  songRow: {
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
  art: {
    flexShrink: 0,
    width: 44,
    height: 44,
    objectFit: "cover",
    borderRadius: 8,
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  songMeta: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  songTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
    whiteSpace: "nowrap",
  },
  songTitleLink: {
    textDecoration: {
      default: "none",
      ":hover": {
        default: "none",
        [chatMedia.hover]: "underline",
      },
    },
  },
  songArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 30,
    height: 30,
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
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionHeader: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "baseline",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  expiryHint: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
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
  expiredCard: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingBlock: 24,
    paddingInline: 18,
    textAlign: "center",
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 14,
  },
  expiredTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
  },
  expiredDesc: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: t.muted,
  },
  stateBox: {
    paddingBlock: 36,
    paddingInline: 16,
    fontSize: 14,
    color: t.muted,
    textAlign: "center",
  },
  errorBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    padding: 24,
    textAlign: "center",
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
  },
  errorMessage: {
    margin: 0,
    fontSize: 14,
    color: t.danger,
  },
  errorAction: {
    display: "inline-flex",
    alignItems: "center",
    height: 34,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    textDecoration: "none",
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  inlineError: {
    margin: 0,
    fontSize: 14,
    color: t.danger,
  },
});
