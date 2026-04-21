import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../../shared/db";
import { artists } from "../../shared/db/schema";
import type { ArtistCreateDbModel, ArtistUpdateDbModel } from "./model";

export const listArtists = async (tx: DatabaseTransaction) => {
	return tx
		.select()
		.from(artists)
		.where(isNull(artists.deletedAt))
		.orderBy(desc(artists.createdAt));
};

export const createArtist = async (tx: DatabaseTransaction, values: ArtistCreateDbModel) => {
	return tx.insert(artists).values(values).returning();
};

export const findArtistById = async (tx: DatabaseTransaction, id: string) => {
	const rows = await tx
		.select()
		.from(artists)
		.where(and(eq(artists.id, id), isNull(artists.deletedAt)))
		.limit(1);
	return rows[0] ?? null;
};

export const updateArtistById = async (
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
		.returning();

	return rows[0] ?? null;
};

export const softDeleteArtistById = async (tx: DatabaseTransaction, id: string) => {
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
