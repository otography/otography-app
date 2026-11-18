/**
 * ローカルの DB に、動作を試すためのダミーのデータを入れる。
 * vp run db#db:seed で実行する。何度実行しても、同じ行を二重には入れない。
 *
 * ダミーのユーザーは Google のアカウントを持たないので、ログインできない。
 * 自分でログインしてから、ダミーのユーザーのプロフィール（/u/seed-aoi など）や投稿を見て、いいねや通報を試す。
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  artists,
  favoriteArtists,
  favoriteSongs,
  likes,
  posts,
  relations,
  songs,
  users,
} from "../src/index.ts";

const url = process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080";

// ステージングや本番の DB にダミーのデータを入れないように、ローカルの DB だけを受け付ける。
const isLocal =
  url.startsWith("file:") || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);
if (!isLocal) {
  console.error(
    `ローカルの DB ではないので中止しました：${url}\nturso dev の URL（http://127.0.0.1:8080）を TURSO_DATABASE_URL に入れてください`,
  );
  process.exit(1);
}

const db = drizzle({ client: createClient({ url }), relations });

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

const seedUsers = [
  { id: "seed-user-aoi", publicId: "seed-aoi", name: "Aoi", bio: "夜に聴く曲を集めています" },
  { id: "seed-user-haru", publicId: "seed-haru", name: "haru", bio: "雨の日の音楽が好き" },
  { id: "seed-user-yuuki", publicId: "seed-yuuki", name: "Yuuki", bio: null },
].map((user) => ({ ...user, email: `${user.publicId}@seed.invalid` }));

// ISRC と Apple の ID はダミー。画像とリンクは無いので、画面には曲名とアーティスト名だけが出る。
const seedSongs = [
  { isrc: "ZZSEED000001", appleSongId: "seed-1", title: "夜の帰り道", artistName: "Seed Band" },
  { isrc: "ZZSEED000002", appleSongId: "seed-2", title: "Lighthouse", artistName: "Seed Singer" },
  {
    isrc: "ZZSEED000003",
    appleSongId: "seed-3",
    title: "スローモーション",
    artistName: "Seed Band",
  },
  { isrc: "ZZSEED000004", appleSongId: "seed-4", title: "海の幽霊", artistName: "Seed Trio" },
].map((song) => ({ ...song, fetchedAt: new Date() }));

const seedArtists = [
  { id: "seed-artist-1", name: "Seed Band" },
  { id: "seed-artist-2", name: "Seed Singer" },
].map((artist) => ({ ...artist, fetchedAt: new Date() }));

const seedPosts = [
  {
    id: "seed-post-01",
    userId: "seed-user-aoi",
    songIsrc: "ZZSEED000001",
    content: "夜の帰り道、風がちょっと優しくなる曲。",
    createdAt: daysAgo(0.1),
  },
  {
    id: "seed-post-02",
    userId: "seed-user-haru",
    songIsrc: "ZZSEED000002",
    content: "雨の匂いがする朝にぴったり。",
    createdAt: daysAgo(0.5),
  },
  {
    id: "seed-post-03",
    userId: "seed-user-yuuki",
    songIsrc: "ZZSEED000003",
    content: "何も考えたくない日にずっとリピートしてる。",
    createdAt: daysAgo(1),
  },
  {
    id: "seed-post-04",
    userId: "seed-user-aoi",
    songIsrc: "ZZSEED000004",
    content: "波の音と一緒に思い出がよみがえる。",
    createdAt: daysAgo(2),
  },
  {
    id: "seed-post-05",
    userId: "seed-user-haru",
    songIsrc: "ZZSEED000001",
    content: "同じ曲でも、帰り道に聴くと違って聞こえる。",
    createdAt: daysAgo(3),
  },
  {
    id: "seed-post-06",
    userId: "seed-user-aoi",
    songIsrc: "ZZSEED000002",
    content: "サビの前の一瞬の静けさが好き。",
    createdAt: daysAgo(4),
  },
].map((post) => ({ ...post, updatedAt: post.createdAt }));

const seedLikes = [
  { userId: "seed-user-haru", postId: "seed-post-01" },
  { userId: "seed-user-yuuki", postId: "seed-post-01" },
  { userId: "seed-user-aoi", postId: "seed-post-02" },
  { userId: "seed-user-aoi", postId: "seed-post-03" },
  { userId: "seed-user-haru", postId: "seed-post-04" },
];

// like_count は likes の行数と合わせる（API はいいねのたびに数え直すので、ずれていると件数が飛ぶ）。
const likeCount = (postId: string) => seedLikes.filter((like) => like.postId === postId).length;

const seedFavoriteSongs = [
  {
    userId: "seed-user-aoi",
    songIsrc: "ZZSEED000001",
    position: 0,
    comment: "毎晩聴いている",
    emoji: "🌙",
    color: "violet" as const,
  },
  {
    userId: "seed-user-aoi",
    songIsrc: "ZZSEED000004",
    position: 1,
    comment: null,
    emoji: null,
    color: null,
  },
  {
    userId: "seed-user-haru",
    songIsrc: "ZZSEED000002",
    position: 0,
    comment: "雨の日の定番",
    emoji: "☔",
    color: "sky" as const,
  },
];

const seedFavoriteArtists = [
  {
    userId: "seed-user-aoi",
    artistId: "seed-artist-1",
    position: 0,
    comment: null,
    emoji: null,
    color: null,
  },
  {
    userId: "seed-user-haru",
    artistId: "seed-artist-2",
    position: 0,
    comment: "声が好き",
    emoji: null,
    color: "pink" as const,
  },
];

// 1 つの batch（トランザクション）で入れる。途中で失敗したら、何も入らない。
await db.batch([
  db.insert(users).values(seedUsers).onConflictDoNothing(),
  db.insert(songs).values(seedSongs).onConflictDoNothing(),
  db.insert(artists).values(seedArtists).onConflictDoNothing(),
  db
    .insert(posts)
    .values(seedPosts.map((post) => ({ ...post, likeCount: likeCount(post.id) })))
    .onConflictDoNothing(),
  db.insert(likes).values(seedLikes).onConflictDoNothing(),
  db.insert(favoriteSongs).values(seedFavoriteSongs).onConflictDoNothing(),
  db.insert(favoriteArtists).values(seedFavoriteArtists).onConflictDoNothing(),
]);

console.log(
  `ダミーのデータを入れました（${url}）：ユーザー ${seedUsers.length}、曲 ${seedSongs.length}、投稿 ${seedPosts.length}\n` +
    `プロフィール：${seedUsers.map((user) => `/u/${user.publicId}`).join("、")}`,
);
