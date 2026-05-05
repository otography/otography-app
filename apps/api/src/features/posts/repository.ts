import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../shared/db";
import { posts, userProfiles } from "../../shared/db/schema";
import type { PostInsertDbModel, PostUpdateDbModel } from "./model";

const postColumns = {
  id: posts.id,
  userId: posts.userId,
  songId: posts.songId,
  content: posts.content,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
} as const;

const authorColumns = {
  username: userProfiles.username,
  name: userProfiles.name,
} as const;

export const listPosts = async (db: DatabaseOrTransaction) => {
  return db
    .select({
      ...postColumns,
      author: authorColumns,
    })
    .from(posts)
    .innerJoin(userProfiles, eq(posts.userId, userProfiles.id))
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.createdAt));
};

export const findPostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select({
      ...postColumns,
      author: authorColumns,
    })
    .from(posts)
    .innerJoin(userProfiles, eq(posts.userId, userProfiles.id))
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};

export const createPost = async (db: DatabaseOrTransaction, values: PostInsertDbModel) => {
  return db.insert(posts).values(values).returning(postColumns);
};

export const updatePostById = async (
  db: DatabaseOrTransaction,
  { id, values }: { id: string; values: PostUpdateDbModel },
) => {
  const rows = await db
    .update(posts)
    .set({
      ...values,
      updatedAt: sql`now()`,
    })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning(postColumns);

  return rows[0] ?? null;
};

export const softDeletePostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .update(posts)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning({ id: posts.id });

  return rows[0] ?? null;
};

// 投稿の存在確認（soft-deleted除外）
export const findActivePostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};
