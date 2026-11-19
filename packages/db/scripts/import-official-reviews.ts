/**
 * 公式アカウント（/u/otography）と、その曲の感想を DB に入れる。
 * データは data/official-reviews.json（曲 877、投稿 3,678）。
 * GitHub Actions（.github/workflows/import-official-reviews.yml）から、staging と本番に対して手動で実行する。
 *
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... vp run db#db:import-official-reviews
 *
 * 何度実行しても、同じ行を二重には入れない（主キーが同じ行は飛ばす）。
 * - 投稿の ID は、データの key から作る（同じ key なら同じ ID になる）
 * - 投稿日時は、実行した時点から過去 90 日に散らす。2 回目以降の実行で入る行はないので、日時も変わらない
 * - 埋め込みは入れない。埋め込みのない投稿は意味検索に出ないだけで、後でバッチが作る（docs/adr/0001-post-embeddings-table.md）
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { POST_CONTENT_MAX } from "../src/constants.ts";
import { posts, relations, songs, users } from "../src/index.ts";
import { OFFICIAL_USER_ID, officialPostId } from "../src/official-reviews.ts";

type ReviewData = {
  songs: {
    isrc: string;
    appleSongId: string;
    title: string | null;
    artistName: string | null;
    albumName: string | null;
    durationMs: number | null;
    artworkUrl: string | null;
    url: string | null;
    artistIds: string[];
  }[];
  posts: { key: string; isrc: string; content: string }[];
};

const OFFICIAL = {
  id: OFFICIAL_USER_ID,
  publicId: "otography",
  name: "otography",
  email: "official@otography.invalid",
  bio: "otography の公式アカウントです。",
  isAdmin: true,
  image: "/otography-icon.png", // apps/website/public の画像。Worker の静的アセットとして配信する
};
const SPREAD_MS = 90 * 24 * 60 * 60 * 1000;
const CHUNK = 200;

const url = process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080";
const db = drizzle({
  client: createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined }),
  relations,
});

const data = JSON.parse(
  await readFile(new URL("../data/official-reviews.json", import.meta.url), "utf8"),
) as ReviewData;

const postId = officialPostId;

// DB の CHECK 制約（length()）と同じく、コードポイントで数える。書記素で数えると DB と食い違う。
// oxlint-disable-next-line typescript/no-misused-spread
const tooLong = data.posts.filter((p) => [...p.content].length > POST_CONTENT_MAX);
if (tooLong.length > 0) {
  console.error(
    `${POST_CONTENT_MAX} 文字を超える投稿があるので中止しました：${tooLong.map((p) => p.key).join(", ")}`,
  );
  process.exit(1);
}

const now = Date.now();
// 曲ごとに投稿がかたまらないように、ID の順で並べてから日時を割り当てる。
const rows = data.posts
  .map((p) => ({ ...p, id: postId(p.key) }))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((p, i, all) => {
    const createdAt = new Date(now - Math.round((SPREAD_MS * (i + 0.5)) / all.length));
    return {
      id: p.id,
      userId: OFFICIAL.id,
      songIsrc: p.isrc,
      content: p.content,
      createdAt,
      updatedAt: createdAt,
    };
  });

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

// アイコンは後から足したので、既にある行でも image だけは書き直す。
await db
  .insert(users)
  .values(OFFICIAL)
  .onConflictDoUpdate({ target: users.id, set: { image: OFFICIAL.image } });
const fetchedAt = new Date(now);
for (const part of chunks(data.songs)) {
  await db
    .insert(songs)
    .values(part.map((s) => ({ ...s, fetchedAt })))
    .onConflictDoNothing();
}
let inserted = 0;
for (const part of chunks(rows)) {
  const result = await db
    .insert(posts)
    .values(part)
    .onConflictDoNothing()
    .returning({ id: posts.id });
  inserted += result.length;
}

console.log(
  `公式アカウントの感想を入れました（${url.replace(/\/\/.*@/, "//")}）：曲 ${data.songs.length}、投稿 ${inserted} / ${rows.length}（残りは入れ済み）\n` +
    `プロフィール：/u/${OFFICIAL.publicId}`,
);
