import type { Database } from "../../lib/db.ts";
import { findVisiblePostsByAuthor } from "../repository.ts";
import { encodePostCursor } from "../schemas.ts";
import { toPostView } from "./post-view.ts";

const PAGE_SIZE = 20;

/**
 * ユーザーの投稿を新しい順に 1 ページ分返す。続きがあれば、次のページの位置（nextCursor）を返す。
 * ユーザーが見つからない場合も、空の一覧を返す（プロフィールの取得が 404 を返すので、ここでは区別しない）。
 */
export async function listPostsByAuthor({
  db,
  publicId,
  viewerId,
  before,
}: {
  db: Database;
  publicId: string;
  viewerId: string;
  before: { createdAt: Date; id: string } | null;
}) {
  // 1 件多く読み、続きがあるかを判定する。
  const rows = await findVisiblePostsByAuthor({
    db,
    publicId,
    viewerId,
    before,
    limit: PAGE_SIZE + 1,
  });
  if (rows instanceof Error) return rows;

  const page = rows.slice(0, PAGE_SIZE);
  const posts = [];
  for (const row of page) {
    const view = toPostView(row);
    if (view instanceof Error) return view;
    posts.push(view);
  }
  const last = page.at(-1);
  const nextCursor = rows.length > PAGE_SIZE && last ? encodePostCursor(last) : null;
  return { posts, nextCursor };
}
