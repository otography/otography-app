import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { artists } from "../../shared/db/schema";
import type { DatabaseOrTransaction } from "../../shared/db";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

const artistColumns = {
  id: artists.id,
  name: artists.name,
  appleMusicId: artists.appleMusicId,
  ipiCode: artists.ipiCode,
  type: artists.type,
  gender: artists.gender,
  birthplace: artists.birthplace,
  birthdate: artists.birthdate,
  createdAt: artists.createdAt,
  updatedAt: artists.updatedAt,
} as const;

export const listArtists = async (db: DatabaseOrTransaction) => {
  return db
    .select(artistColumns)
    .from(artists)
    .where(isNull(artists.deletedAt))
    .orderBy(desc(artists.createdAt));
};

export const createArtist = async (db: DatabaseOrTransaction, values: ArtistCreateDbModel) => {
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
