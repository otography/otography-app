import { favoriteSongs, users } from "db";
import { eq } from "drizzle-orm";
import type { Database } from "../lib/db.ts";
import { UserQueryError } from "./errors.ts";

/** 公開 ID でユーザーとお気に入りを読む。利用停止中・退会済みのユーザーは見つからない扱いにする。 */
export const findProfileByPublicId = ({ db, publicId }: { db: Database; publicId: string }) =>
  db.query.users
    .findFirst({
      where: { publicId, suspendedAt: { isNull: true }, deletedAt: { isNull: true } },
      columns: { publicId: true, name: true, bio: true },
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
    .catch((e) => new UserQueryError({ cause: e }));

/** 内部 ID でユーザーを読む。 */
export const findUserById = ({ db, userId }: { db: Database; userId: string }) =>
  db.query.users
    .findFirst({ where: { id: userId } })
    .then((user) => user ?? null)
    .catch((e) => new UserQueryError({ cause: e }));

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
    .catch((e) => new UserQueryError({ cause: e }));

/**
 * お気に入りの曲を一覧ごと置き換える。削除と追加を 1 つの batch（トランザクション）で行うので、
 * 途中で失敗しても、元の一覧が残る。
 */
export const replaceFavoriteSongs = ({
  db,
  userId,
  items,
}: {
  db: Database;
  userId: string;
  items: Omit<typeof favoriteSongs.$inferInsert, "userId">[];
}) => {
  const remove = db.delete(favoriteSongs).where(eq(favoriteSongs.userId, userId));
  const result = items.length
    ? db.batch([
        remove,
        db.insert(favoriteSongs).values(items.map((item) => ({ ...item, userId }))),
      ])
    : db.batch([remove]);
  return result.then(() => null).catch((e) => new UserQueryError({ cause: e }));
};
