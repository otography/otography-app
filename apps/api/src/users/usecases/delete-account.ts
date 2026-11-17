import type { Database } from "../../lib/db.ts";
import { softDeleteUser } from "../repository.ts";

/**
 * ログイン中のユーザーを退会させる。表示名・自己紹介・お気に入り・ログイン連携・いいねを即座に消し、
 * 投稿をすべての画面から消す。行は 90 日後にバッチが物理削除する。
 */
export const deleteAccount = ({ db, userId }: { db: Database; userId: string }) =>
  softDeleteUser({ db, userId });
