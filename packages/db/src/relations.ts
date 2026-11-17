import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.ts";

// 削除・非表示ではない投稿だけを返す条件。投稿の一覧を返すリレーションには、既定でこの条件を付ける。
const visiblePost = { deletedAt: { isNull: true }, hiddenAt: { isNull: true } } as const;

// 次の表には、意図してリレーションを定義していない。
// - postIpLogs：API の応答に絶対に含めないため。with で誤って読み出せないようにする
export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions(),
    accounts: r.many.accounts(),
    // 削除・非表示ではない投稿。プロフィールなど、他人に見せる一覧で使う
    posts: r.many.posts({ from: r.users.id, to: r.posts.userId, where: visiblePost }),
    // 削除・非表示を含むすべての投稿。本人の履歴や管理画面など、条件を自分で決める場合だけ使う
    allPosts: r.many.posts({ from: r.users.id, to: r.posts.userId }),
    likes: r.many.likes(),
    favoriteSongs: r.many.favoriteSongs(),
    favoriteArtists: r.many.favoriteArtists(),
    // 通報者と通報されたユーザーは、どちらも users を指すので alias で区別する。
    reportsMade: r.many.reports({ alias: "reporter" }),
    reportsReceived: r.many.reports({ alias: "targetUser" }),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.userId, to: r.users.id, optional: false }),
  },
  accounts: {
    user: r.one.users({ from: r.accounts.userId, to: r.users.id, optional: false }),
  },
  songs: {
    // 「曲で探す」で使う。削除・非表示の投稿は含めない
    posts: r.many.posts({ from: r.songs.isrc, to: r.posts.songIsrc, where: visiblePost }),
  },
  favoriteSongs: {
    user: r.one.users({ from: r.favoriteSongs.userId, to: r.users.id, optional: false }),
    song: r.one.songs({ from: r.favoriteSongs.songIsrc, to: r.songs.isrc, optional: false }),
  },
  favoriteArtists: {
    user: r.one.users({ from: r.favoriteArtists.userId, to: r.users.id, optional: false }),
    artist: r.one.artists({ from: r.favoriteArtists.artistId, to: r.artists.id, optional: false }),
  },
  posts: {
    author: r.one.users({ from: r.posts.userId, to: r.users.id, optional: false }),
    song: r.one.songs({ from: r.posts.songIsrc, to: r.songs.isrc }),
    likes: r.many.likes(),
    embedding: r.one.postEmbeddings({ from: r.posts.id, to: r.postEmbeddings.postId }),
  },
  postEmbeddings: {
    post: r.one.posts({ from: r.postEmbeddings.postId, to: r.posts.id, optional: false }),
  },
  reports: {
    reporter: r.one.users({ from: r.reports.reporterId, to: r.users.id, alias: "reporter" }),
    targetUser: r.one.users({ from: r.reports.targetUserId, to: r.users.id, alias: "targetUser" }),
    post: r.one.posts({ from: r.reports.postId, to: r.posts.id }),
  },
  likes: {
    user: r.one.users({ from: r.likes.userId, to: r.users.id, optional: false }),
    post: r.one.posts({ from: r.likes.postId, to: r.posts.id, optional: false }),
  },
}));
