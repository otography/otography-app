import { and, desc, eq, exists, getColumns, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../shared/db";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { Cursor } from "../../shared/pagination";
import { postLikes, posts, userProfiles } from "../../shared/db/schema";
import type { PostInsertDbModel, PostUpdateDbModel } from "./model";

const { deletedAt: _, ...postColumns } = getColumns(posts);

const authorColumns = {
  username: userProfiles.username,
  name: userProfiles.name,
} as const;

// いいね情報のスカラーサブクエリ（groupBy 不要、自己完結）
const likeFields = (db: DatabaseOrTransaction, userId: string | null) => ({
  likeCount: db.$count(postLikes, eq(postLikes.postId, posts.id)),
  isLiked: userId
    ? exists(
        db
          .select()
          .from(postLikes)
          .where(and(eq(postLikes.postId, posts.id), eq(postLikes.userId, userId))),
      ).as("isLiked")
    : sql<boolean>`false`.as("isLiked"),
});

// 投稿一覧をいいね情報付きで1クエリで取得（ページネーション対応）
export const listPostsWithLikes = async (
  db: DatabaseOrTransaction,
  userId: string | null,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  const { cursor } = pagination ?? {};

  const conditions = [isNull(posts.deletedAt)];

  if (cursor) {
    conditions.push(cursorWhereClause(posts.createdAt, posts.id, cursor));
  }

  return withPagination(
    db
      .select({
        ...postColumns,
        author: authorColumns,
        ...likeFields(db, userId),
      })
      .from(posts)
      .innerJoin(userProfiles, eq(posts.userId, userProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .$dynamic(),
    pagination,
  );
};

// 投稿詳細をいいね情報付きで1クエリで取得
export const findPostByIdWithLikes = async (
  db: DatabaseOrTransaction,
  id: string,
  userId: string | null,
) => {
  const rows = await db
    .select({
      ...postColumns,
      author: authorColumns,
      ...likeFields(db, userId),
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
    })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning({ id: posts.id });

  return rows[0] ?? null;
};

export const findActivePostById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
};
