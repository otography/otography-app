import {
  accounts,
  favoriteArtists,
  favoriteSongs,
  likes,
  postEmbeddings,
  posts,
  sessions,
  users,
} from "db";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { UserQueryError } from "./errors.ts";

/** 公開 ID でユーザーとお気に入りを読む。利用停止中・退会済みのユーザーは見つからない扱いにする。 */
export const findProfileByPublicId = ({ db, publicId }: { db: Database; publicId: string }) =>
  db.query.users
    .findFirst({
      where: { publicId, suspendedAt: { isNull: true }, deletedAt: { isNull: true } },
      columns: { publicId: true, name: true, bio: true, image: true },
      with: {
        favoriteSongs: {
          columns: { comment: true, emoji: true, color: true },
          orderBy: { position: "asc" },
          with: { song: true },
        },
        favoriteArtists: {
          columns: { comment: true, emoji: true, color: true },
          orderBy: { position: "asc" },
          with: { artist: true },
        },
      },
    })
    .then((user) => user ?? null)
    .catch((error: unknown) => new UserQueryError({ cause: error }));

/** 内部 ID でユーザーを読む。 */
export const findUserById = ({ db, userId }: { db: Database; userId: string }) =>
  db.query.users
    .findFirst({ where: { id: userId } })
    .then((user) => user ?? null)
    .catch((error: unknown) => new UserQueryError({ cause: error }));

/** 表示名と自己紹介を変える。 */
export const updateUser = ({
  db,
  userId,
  values,
}: {
  db: Database;
  userId: string;
  values: { name?: string; bio?: string | null };
}) =>
  db
    .update(users)
    .set(values)
    .where(eq(users.id, userId))
    .then(() => null)
    .catch((error: unknown) => new UserQueryError({ cause: error }));

type BatchItem = Parameters<Database["batch"]>[0][number];

// 削除と追加を 1 つの batch（トランザクション）で行う。途中で失敗しても、元の一覧が残る。
const replaceRows = ({
  db,
  remove,
  insert,
}: {
  db: Database;
  remove: BatchItem;
  insert: BatchItem | null;
}) =>
  (insert ? db.batch([remove, insert]) : db.batch([remove]))
    .then(() => null)
    .catch((error: unknown) => new UserQueryError({ cause: error }));

/** お気に入りの曲を一覧ごと置き換える。 */
export const replaceFavoriteSongs = ({
  db,
  userId,
  items,
}: {
  db: Database;
  userId: string;
  items: Array<Omit<typeof favoriteSongs.$inferInsert, "userId">>;
}) =>
  replaceRows({
    db,
    remove: db.delete(favoriteSongs).where(eq(favoriteSongs.userId, userId)),
    insert: items.length
      ? db.insert(favoriteSongs).values(items.map((item) => ({ ...item, userId })))
      : null,
  });

/** お気に入りのアーティストを一覧ごと置き換える。 */
export const replaceFavoriteArtists = ({
  db,
  userId,
  items,
}: {
  db: Database;
  userId: string;
  items: Array<Omit<typeof favoriteArtists.$inferInsert, "userId">>;
}) =>
  replaceRows({
    db,
    remove: db.delete(favoriteArtists).where(eq(favoriteArtists.userId, userId)),
    insert: items.length
      ? db.insert(favoriteArtists).values(items.map((item) => ({ ...item, userId })))
      : null,
  });

/** 退会したユーザーの表示名。表示名の CHECK 制約（1 文字以上）を満たすために入れる。 */
const DELETED_USER_NAME = "退会したユーザー";

/**
 * 退会の処理を、1 つの batch（トランザクション）で行う。
 * - users：deleted_at を立て、表示名・自己紹介を消し、メールアドレスを無効な値に置き換える
 * - お気に入り、ログイン連携（accounts）、セッションを消す
 * - 投稿の埋め込みを消す（投稿は、投稿者の deleted_at によってすべての画面から消える）
 * - このユーザーのいいねを消し、いいねしていた投稿の件数を数え直す
 * 行そのものは 90 日後にバッチが物理削除し、CASCADE で投稿なども消える。
 */
export const softDeleteUser = ({ db, userId }: { db: Database; userId: string }) =>
  db
    .batch([
      db
        .update(users)
        .set({
          deletedAt: new Date(),
          name: DELETED_USER_NAME,
          bio: null,
          image: null,
          // email は UNIQUE なので、ユーザーごとに違う無効な値にする。同じ Google アカウントで作り直せる。
          email: `deleted-${userId}@invalid`,
        })
        .where(eq(users.id, userId)),
      db.delete(favoriteSongs).where(eq(favoriteSongs.userId, userId)),
      db.delete(favoriteArtists).where(eq(favoriteArtists.userId, userId)),
      db.delete(accounts).where(eq(accounts.userId, userId)),
      db.delete(sessions).where(eq(sessions.userId, userId)),
      db
        .delete(postEmbeddings)
        .where(
          inArray(
            postEmbeddings.postId,
            db.select({ id: posts.id }).from(posts).where(eq(posts.userId, userId)),
          ),
        ),
      // いいねを消す前に、このユーザーのいいねを除いた件数で数え直す。
      // set に updated_at の列そのものを渡し、$onUpdate を止めて今の値を保つ。
      db
        .update(posts)
        .set({
          likeCount: db.$count(likes, and(eq(likes.postId, posts.id), ne(likes.userId, userId))),
          updatedAt: posts.updatedAt,
        })
        .where(
          inArray(
            posts.id,
            db.select({ id: likes.postId }).from(likes).where(eq(likes.userId, userId)),
          ),
        ),
      db.delete(likes).where(eq(likes.userId, userId)),
    ])
    .then(() => null)
    .catch((error: unknown) => new UserQueryError({ cause: error }));
