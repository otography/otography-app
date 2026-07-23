import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import type { Database, DatabaseTransaction } from "../../shared/db";
import { toDbError } from "../../shared/db/postgres-error";
import { withRls } from "../../shared/db/rls";
import type { Cursor } from "../../shared/pagination";
import { createPage, normalizeLimit } from "../../shared/pagination";

type PaginationInput = { limit?: number; cursor?: Cursor | null };

type FavoriteMetadata = {
  comment: string | null;
  emoji: string | null;
  color: string | null;
  createdAt: string;
};

type FavoritePageOptions<T extends { favorite: FavoriteMetadata }, U extends object> = {
  pagination?: PaginationInput;
  load: (pagination: PaginationInput) => Promise<T[] | Error>;
  errorMessage: string;
  getFavoriteId: (row: T) => string;
  mapResource: (row: T) => U;
};

const createFavoritePage = <T extends { favorite: FavoriteMetadata }, U extends object>(
  rows: T[],
  limit: number,
  getFavoriteId: (row: T) => string,
  mapResource: (row: T) => U,
) => {
  const page = createPage(
    rows,
    limit,
    (row) => ({
      ...mapResource(row),
      comment: row.favorite.comment,
      emoji: row.favorite.emoji,
      color: row.favorite.color,
      addedAt: row.favorite.createdAt,
    }),
    (row) => ({ id: getFavoriteId(row), createdAt: row.favorite.createdAt }),
  );

  return { favorites: page.items, pagination: page.pagination };
};

/** private/public に依存しない、お気に入り一覧ユースケース */
export const getFavoritePage = async <T extends { favorite: FavoriteMetadata }, U extends object>({
  pagination,
  load,
  errorMessage,
  getFavoriteId,
  mapResource,
}: FavoritePageOptions<T, U>) => {
  const limit = normalizeLimit(pagination?.limit);
  const rows = await load({ limit, cursor: pagination?.cursor }).catch((e) =>
    toDbError(e, errorMessage),
  );
  if (rows instanceof Error) return toDbError(rows, errorMessage);

  return createFavoritePage(rows, limit, getFavoriteId, mapResource);
};

type DeleteFavoriteOptions = {
  session: DecodedIdToken;
  appleMusicId: string;
  db: Database;
  findResource: (tx: DatabaseTransaction, appleMusicId: string) => Promise<{ id: string } | null>;
  remove: (tx: DatabaseTransaction, userId: string, resourceId: string) => Promise<unknown[]>;
  errorMessage: string;
  notFoundMessage: string;
};

/** リソース種別に依存しない、お気に入り削除ユースケース */
export const deleteFavorite = async ({
  session,
  appleMusicId,
  db,
  findResource,
  remove,
  errorMessage,
  notFoundMessage,
}: DeleteFavoriteOptions) => {
  const result = await withRls(db, session, async (tx, userId) => {
    const resource = await findResource(tx, appleMusicId);
    if (!resource) return [];
    return remove(tx, userId, resource.id);
  });
  if (result instanceof Error) return toDbError(result, errorMessage);

  if (result.length === 0) {
    return new DbError({ message: notFoundMessage, statusCode: 404 });
  }
  return { deleted: true };
};
