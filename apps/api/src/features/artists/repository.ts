import { and, desc, eq, getColumns, isNull } from "drizzle-orm";
import { artists } from "../../shared/db/schema";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { Cursor } from "../../shared/pagination";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import type { ArtistCreateDbValues, ArtistSyncDbValues } from "./model";

const { deletedAt: _, ...artistColumns } = getColumns(artists);

export const listArtists = async (
  db: DatabaseOrTransaction,
  pagination?: { limit?: number; cursor?: Cursor | null },
) => {
  const { cursor } = pagination ?? {};
  const conditions = [isNull(artists.deletedAt)];

  if (cursor) {
    conditions.push(cursorWhereClause(artists.createdAt, artists.id, cursor));
  }

  return withPagination(
    db
      .select(artistColumns)
      .from(artists)
      .where(and(...conditions))
      .orderBy(desc(artists.createdAt), desc(artists.id))
      .$dynamic(),
    pagination,
  );
};

export const createArtist = async (db: DatabaseOrTransaction, values: ArtistCreateDbValues) => {
  return db.insert(artists).values(values).returning(artistColumns);
};

export const findArtistById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .select(artistColumns)
    .from(artists)
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

export const updateArtistById = async (
  db: DatabaseOrTransaction,
  { id, values }: { id: string; values: ArtistSyncDbValues },
) => {
  const rows = await db
    .update(artists)
    .set({
      ...values,
    })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning(artistColumns);

  return rows[0] ?? null;
};

// appleMusicId でアーティストを検索（soft-deleted 除外）
// apple-music-sync.ts の createArtistFromAppleMusic からも参照される
export const artistLookupColumns = {
  id: artists.id,
  name: artists.name,
  appleMusicId: artists.appleMusicId,
} as const;

// appleMusicId でアーティストの存在確認（soft-deleted 除外、軽量）
export const artistExistsByAppleMusicId = async (
  db: DatabaseOrTransaction,
  appleMusicId: string,
) => {
  const rows = await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.appleMusicId, appleMusicId), isNull(artists.deletedAt)))
    .limit(1);
  return rows.length > 0;
};

export const findArtistByAppleMusicId = async (tx: DatabaseTransaction, appleMusicId: string) => {
  const rows = await tx
    .select(artistLookupColumns)
    .from(artists)
    .where(and(eq(artists.appleMusicId, appleMusicId), isNull(artists.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};
