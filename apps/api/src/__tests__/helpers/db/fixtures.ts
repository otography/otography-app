import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  artists,
  genres,
  postLikes,
  posts,
  songGenres,
  songs,
  users,
} from "../../../shared/db/schema";

type Db = PostgresJsDatabase<Record<string, never>>;

// テストデータ構築ヘルパー
// 各ヘルパーは「何を作ったか」を返し、DB操作の詳細を隠す

let counter = 0;
const uniqueId = () => `test-${++counter}-${Date.now()}`;

export const createUser = async (
  db: Db,
  overrides: { firebaseId?: string; username?: string; name?: string } = {},
) => {
  const id = uniqueId();
  const [row] = await db
    .insert(users)
    .values({
      firebaseId: overrides.firebaseId ?? `fb-${id}`,
      username: overrides.username,
      name: overrides.name,
    })
    .returning({ id: users.id });
  return row!;
};

export const createSong = async (
  db: Db,
  overrides: { title?: string; appleMusicId?: string; deletedAt?: string } = {},
) => {
  const id = uniqueId();
  const [row] = await db
    .insert(songs)
    .values({
      title: overrides.title ?? `Song ${id}`,
      appleMusicId: overrides.appleMusicId ?? `am-${id}`,
      deletedAt: overrides.deletedAt,
    })
    .returning({ id: songs.id, createdAt: songs.createdAt });
  return row!;
};

export const createArtist = async (
  db: Db,
  overrides: { name?: string; appleMusicId?: string; deletedAt?: string } = {},
) => {
  const id = uniqueId();
  const [row] = await db
    .insert(artists)
    .values({
      name: overrides.name ?? `Artist ${id}`,
      appleMusicId: overrides.appleMusicId ?? `am-${id}`,
      deletedAt: overrides.deletedAt,
    })
    .returning({ id: artists.id });
  return row!;
};

export const createPost = async (
  db: Db,
  userId: string,
  songId: string,
  overrides: { content?: string; deletedAt?: string } = {},
) => {
  const id = uniqueId();
  const [row] = await db
    .insert(posts)
    .values({
      userId,
      songId,
      content: overrides.content ?? `Post content ${id}`,
      deletedAt: overrides.deletedAt,
    })
    .returning({ id: posts.id, createdAt: posts.createdAt });
  return row!;
};

export const likePost = async (db: Db, userId: string, postId: string) => {
  await db.insert(postLikes).values({ userId, postId });
};

export const createGenre = async (
  db: Db,
  overrides: { name?: string; deletedAt?: string } = {},
) => {
  const id = uniqueId();
  const [row] = await db
    .insert(genres)
    .values({
      name: overrides.name ?? `Genre ${id}`,
      deletedAt: overrides.deletedAt,
    })
    .returning({ id: genres.id, name: genres.name });
  return row!;
};

export const linkSongGenre = async (db: Db, songId: string, genreId: string) => {
  await db.insert(songGenres).values({ songId, genreId });
};
