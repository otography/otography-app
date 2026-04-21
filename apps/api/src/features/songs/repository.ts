import { and, desc, eq, isNull } from "drizzle-orm";
import type { DatabaseTransaction } from "../../shared/db";
import { songs } from "../../shared/db/schema";

type CreateSongInput = {
	title: string;
	length?: number;
	isrcs?: string;
};

export const listSongs = async (tx: DatabaseTransaction) => {
	return tx.select().from(songs).where(isNull(songs.deletedAt)).orderBy(desc(songs.createdAt));
};

export const createSong = async (tx: DatabaseTransaction, values: CreateSongInput) => {
	return tx.insert(songs).values(values).returning();
};

export const findSongById = async (tx: DatabaseTransaction, id: string) => {
	const rows = await tx
		.select()
		.from(songs)
		.where(and(eq(songs.id, id), isNull(songs.deletedAt)))
		.limit(1);
	return rows[0] ?? null;
};
