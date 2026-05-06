import { and, desc, eq, getColumns, inArray, isNull, sql } from "drizzle-orm";
import { artists } from "../../shared/db/schema";
import { cursorWhereClause, withPagination } from "../../shared/pagination";
import type { InternalCursor } from "../../shared/pagination";
import type { DatabaseOrTransaction, DatabaseTransaction } from "../../shared/db";
import type { ArtistCreateDbValues, ArtistUpdateDbModel } from "./model";

const { deletedAt: _, ...artistColumns } = getColumns(artists);

export const listArtists = async (
  db: DatabaseOrTransaction,
  pagination?: { limit?: number; cursor?: InternalCursor | null },
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
  { id, values }: { id: string; values: ArtistUpdateDbModel },
) => {
  const rows = await db
    .update(artists)
    .set({
      ...values,
      updatedAt: sql`now()`,
    })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning(artistColumns);

  return rows[0] ?? null;
};

export const softDeleteArtistById = async (db: DatabaseOrTransaction, id: string) => {
  const rows = await db
    .update(artists)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning({ id: artists.id });

  return rows[0] ?? null;
};

// appleMusicId でアーティストを検索（soft-deleted 除外）
const artistLookupColumns = {
  id: artists.id,
  name: artists.name,
  appleMusicId: artists.appleMusicId,
} as const;

export const findArtistByAppleMusicId = async (tx: DatabaseTransaction, appleMusicId: string) => {
  const rows = await tx
    .select(artistLookupColumns)
    .from(artists)
    .where(and(eq(artists.appleMusicId, appleMusicId), isNull(artists.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

// アーティストを新規作成（Apple Music API から取得した情報を使用）
export const createArtistFromAppleMusic = async (
  tx: DatabaseTransaction,
  appleMusicId: string,
  name: string,
) => {
  return tx
    .insert(artists)
    .values({ name, appleMusicId })
    .onConflictDoUpdate({
      target: artists.appleMusicId,
      set: {
        name,
        deletedAt: null,
        updatedAt: sql`now()`,
      },
    })
    .returning(artistLookupColumns);
};

// アーティストをバッチで find-or-create し、DB上のID配列を返す
export const findOrCreateArtists = async (
  db: DatabaseOrTransaction,
  artistEntries: { appleMusicId: string; name: string }[],
) => {
  if (artistEntries.length === 0) return [];

  // 未登録アーティストを一括 INSERT
  const newArtists = artistEntries.filter((a) => a.name);
  if (newArtists.length > 0) {
    await db
      .insert(artists)
      .values(newArtists.map((a) => ({ name: a.name, appleMusicId: a.appleMusicId })))
      .onConflictDoNothing({ target: artists.appleMusicId });
  }

  // 全アーティストの Apple Music ID で一括 SELECT
  const appleMusicIds = artistEntries.map((a) => a.appleMusicId);
  const found = await db
    .select({ id: artists.id })
    .from(artists)
    .where(inArray(artists.appleMusicId, appleMusicIds));

  return found.map((r) => r.id);
};
