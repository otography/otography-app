import { type NewPost, postIpLogs, posts } from "db";
import { sql } from "drizzle-orm";
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
 * いいねを付け、新しい件数を返す。付け済みなら何もしない。
 * 見せてよい投稿でなければ、いいねを保存せずに null を返す。
 */
export const insertLike = async ({
  db,
  userId,
  postId,
}: {
  db: Database;
  userId: string;
  postId: string;
}) => {
  const result = await db
    .batch([
      db.run(sql`
        insert into likes (user_id, post_id, created_at)
        select ${userId}, posts.id, ${Date.now()} from posts
        where posts.id = ${postId} and posts.deleted_at is null and posts.hidden_at is null
        on conflict do nothing
      `),
      recountLikes(db, postId),
    ])
    .catch((e) => new PostQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[1][0]?.likeCount ?? null;
};

/** いいねを外し、新しい件数を返す。見せてよい投稿でなければ null を返す。 */
export const deleteLike = async ({
  db,
  userId,
  postId,
}: {
  db: Database;
  userId: string;
  postId: string;
}) => {
  const result = await db
    .batch([
      db.run(sql`delete from likes where user_id = ${userId} and post_id = ${postId}`),
      recountLikes(db, postId),
    ])
    .catch((e) => new PostQueryError({ cause: e }));
  if (result instanceof Error) return result;
  return result[1][0]?.likeCount ?? null;
};
