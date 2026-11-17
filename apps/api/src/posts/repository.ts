import { type NewPost, postEmbeddings, postIpLogs, posts } from "db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { PostInsertError, PostQueryError } from "./errors.ts";

/**
 * 投稿と、投稿時の IP アドレスを保存する。
 * libSQL の batch は 1 つのトランザクションで実行されるので、片方だけが保存されることはない。
 */
export async function insertPostWithIpLog({
  db,
  post,
  ipAddress,
}: {
  db: Database;
  post: NewPost;
  ipAddress: string;
}) {
  const result = await db
    .batch([
      db.insert(posts).values(post).returning(),
      db.insert(postIpLogs).values({ postId: post.id, userId: post.userId, ipAddress }),
    ])
    .catch((e) => new PostInsertError({ cause: e }));
  if (result instanceof Error) return result;

  const [[inserted]] = result;
  if (!inserted) return new PostInsertError({ cause: new Error("INSERT が行を返さなかった") });
  return inserted;
}

// 他人に見せてよい投稿の条件。投稿が削除・非表示でなく、投稿者が利用停止中・退会済みでない。
const visible = {
  deletedAt: { isNull: true },
  hiddenAt: { isNull: true },
  author: { suspendedAt: { isNull: true }, deletedAt: { isNull: true } },
} as const;

// 投稿 1 件として返す列と関連。likes は閲覧者自身のいいねだけを読み、いいね済みかの判定に使う。
const postColumns = (viewerId: string) =>
  ({
    columns: { id: true, content: true, likeCount: true, createdAt: true },
    with: {
      author: { columns: { publicId: true, name: true } },
      song: true,
      likes: { columns: { userId: true }, where: { userId: viewerId } },
    },
  }) as const;

/** 見せてよい投稿を 1 件読む。 */
export const findVisiblePost = ({
  db,
  postId,
  viewerId,
}: {
  db: Database;
  postId: string;
  viewerId: string;
}) =>
  db.query.posts
    .findFirst({ where: { id: postId, ...visible }, ...postColumns(viewerId) })
    .then((post) => post ?? null)
    .catch((e) => new PostQueryError({ cause: e }));

/**
 * ユーザーの見せてよい投稿を、新しい順に読む。
 * before を渡すと、その投稿（作成日時と ID）より古いものだけを読む。
 */
export const findVisiblePostsByAuthor = ({
  db,
  publicId,
  viewerId,
  before,
  limit,
}: {
  db: Database;
  publicId: string;
  viewerId: string;
  before: { createdAt: Date; id: string } | null;
  limit: number;
}) =>
  db.query.posts
    .findMany({
      where: {
        ...visible,
        author: { ...visible.author, publicId },
        ...(before && {
          OR: [
            { createdAt: { lt: before.createdAt } },
            { createdAt: { eq: before.createdAt }, id: { lt: before.id } },
          ],
        }),
      },
      orderBy: { createdAt: "desc", id: "desc" },
      limit,
      ...postColumns(viewerId),
    })
    .catch((e) => new PostQueryError({ cause: e }));

// like_count を likes の行数に合わせ直し、見せてよい投稿なら新しい件数を返す。
// 増減ではなく数え直すので、同じ操作が重なっても件数がずれない。
// Drizzle の update は updated_at を自動で更新する（$onUpdate）。いいねは投稿の内容の変更ではないので、SQL で書く。
const recountLikes = (db: Database, postId: string) =>
  db.all<{ likeCount: number }>(sql`
    update posts
    set like_count = (select count(*) from likes where likes.post_id = posts.id)
    where id = ${postId}
      and deleted_at is null
      and hidden_at is null
      and user_id in (select id from users where suspended_at is null and deleted_at is null)
    returning like_count as likeCount
  `);

/**
 * いいねを付ける（liked が true）か外し（false）、新しい件数を返す。付け済みに付ける・無いものを外す場合は何もしない。
 * 見せてよい投稿でなければ、いいねを保存せずに null を返す。
 */
export const writeLike = async ({
  db,
  userId,
  postId,
  liked,
}: {
  db: Database;
  userId: string;
  postId: string;
  liked: boolean;
}) => {
  const write = liked
    ? db.run(sql`
        insert into likes (user_id, post_id, created_at)
        select ${userId}, posts.id, ${Date.now()} from posts
        where posts.id = ${postId} and posts.deleted_at is null and posts.hidden_at is null
        on conflict do nothing
      `)
    : db.run(sql`delete from likes where user_id = ${userId} and post_id = ${postId}`);
  const result = await db
    .batch([write, recountLikes(db, postId)])
    .catch((e) => new PostQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[1][0]?.likeCount ?? null;
};

/**
 * 本人の投稿を論理削除し、埋め込みの行を消す。消した投稿の ID を返す。
 * 他人の投稿、無い投稿、削除済みの投稿なら、何もせずに null を返す。
 */
export const softDeletePost = async ({
  db,
  postId,
  userId,
}: {
  db: Database;
  postId: string;
  userId: string;
}) => {
  const own = and(eq(posts.id, postId), eq(posts.userId, userId), isNull(posts.deletedAt));
  const result = await db
    .batch([
      db.update(posts).set({ deletedAt: new Date() }).where(own).returning({ id: posts.id }),
      // 投稿を消せたときだけ、埋め込みも消す（他人の投稿の埋め込みを消さない）。
      db
        .delete(postEmbeddings)
        .where(
          and(
            eq(postEmbeddings.postId, postId),
            sql`exists (select 1 from posts where posts.id = ${postId} and posts.user_id = ${userId})`,
          ),
        ),
    ])
    .catch((e) => new PostQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[0][0]?.id ?? null;
};
