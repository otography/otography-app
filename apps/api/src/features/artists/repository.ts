import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "../../shared/db";
import { artists } from "../../shared/db/schema";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

const artistColumns = {
  id: artists.id,
  name: artists.name,
  ipiCode: artists.ipiCode,
  type: artists.type,
  gender: artists.gender,
  birthplace: artists.birthplace,
  birthdate: artists.birthdate,
  createdAt: artists.createdAt,
  updatedAt: artists.updatedAt,
} as const;

const listArtistsTx = async (tx: DatabaseTransaction) => {
  return tx
    .select(artistColumns)
    .from(artists)
    .where(isNull(artists.deletedAt))
    .orderBy(desc(artists.createdAt));
};

const createArtistTx = async (tx: DatabaseTransaction, values: ArtistCreateDbModel) => {
  return tx.insert(artists).values(values).returning(artistColumns);
};

const findArtistByIdTx = async (tx: DatabaseTransaction, id: string) => {
  const rows = await tx
    .select(artistColumns)
    .from(artists)
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
};

const updateArtistByIdTx = async (
  tx: DatabaseTransaction,
  { id, values }: { id: string; values: ArtistUpdateDbModel },
) => {
  const rows = await tx
    .update(artists)
    .set({
      ...values,
      updatedAt: sql`now()`,
    })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning(artistColumns);

  return rows[0] ?? null;
};

const softDeleteArtistByIdTx = async (tx: DatabaseTransaction, id: string) => {
  const rows = await tx
    .update(artists)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning({ id: artists.id });

  return rows[0] ?? null;
};

export const listArtists = async () => {
  const db = createDb();
  return db
    .transaction((tx) => listArtistsTx(tx))
    .catch((e) => new DbError({ message: "Failed to fetch artists.", cause: e }));
};

export const createArtist = async (values: ArtistCreateDbModel) => {
  const db = createDb();
  return db
    .transaction((tx) => createArtistTx(tx, values))
    .catch((e) => new DbError({ message: "Failed to create artist.", cause: e }));
};

export const findArtistById = async (id: string) => {
  const db = createDb();
  return db
    .transaction((tx) => findArtistByIdTx(tx, id))
    .catch((e) => new DbError({ message: "Failed to fetch artist.", cause: e }));
};

export const updateArtistById = async ({
  id,
  values,
}: {
  id: string;
  values: ArtistUpdateDbModel;
}) => {
  const db = createDb();
  return db
    .transaction((tx) => updateArtistByIdTx(tx, { id, values }))
    .catch((e) => new DbError({ message: "Failed to update artist.", cause: e }));
};

export const softDeleteArtistById = async (id: string) => {
  const db = createDb();
  return db
    .transaction((tx) => softDeleteArtistByIdTx(tx, id))
    .catch((e) => new DbError({ message: "Failed to delete artist.", cause: e }));
};
