import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../shared/db";
import { posts, songs, users } from "../../shared/db/schema";
import type { PostInsertDbModel, PostUpdateDbModel } from "./model";

const postColumns = {
  id: posts.id,
  userId: posts.userId,
  songId: posts.songId,
  content: posts.content,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
} as const;

export const listPosts = async (db: DatabaseOrTransaction) => {
  return db
    .select(postColumns)
    .from(posts)
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.createdAt));
};

export const findPostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};

export const createPost = async (db: DatabaseOrTransaction, values: PostInsertDbModel) => {
  return db.insert(posts).values(values).returning(postColumns);
};

export const updatePostById = async (
  db: DatabaseOrTransaction,
  { id, userId, values }: { id: string; userId: string; values: PostUpdateDbModel },
) => {
  const rows = await db
    .update(posts)
    .set({
      ...values,
      updatedAt: sql`now()`,
    })
    .where(and(eq(posts.id, id), eq(posts.userId, userId), isNull(posts.deletedAt)))
    .returning(postColumns);

  return rows[0] ?? null;
};

export const softDeletePostById = async (
  db: DatabaseOrTransaction,
  { id, userId }: { id: string; userId: string },
) => {
  const rows = await db
    .update(posts)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(posts.id, id), eq(posts.userId, userId), isNull(posts.deletedAt)))
    .returning({ id: posts.id });

  return rows[0] ?? null;
};

export const findActiveUserByFirebaseId = async (db: DatabaseOrTransaction, firebaseId: string) => {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.firebaseId, firebaseId), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};

export const findActiveSongById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.id, id), isNull(songs.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};
