import { type NewPost, postIpLogs, posts } from "db";
import type { Database } from "../lib/db.ts";
import { PostInsertError } from "./errors.ts";

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
