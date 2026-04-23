import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { songs } from "../../shared/db/schema";

type SongDbModel = InferSelectModel<typeof songs>;
type Song = Omit<SongDbModel, "createdAt" | "updatedAt" | "deletedAt">;

export type SongCreateDbModel = Omit<
  InferInsertModel<typeof songs>,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type SongCreatePayload = SongCreateDbModel;

export const toSong = (model: SongDbModel): Song => {
  const { createdAt: _createdAt, deletedAt: _deletedAt, updatedAt: _updatedAt, ...song } = model;
  return song;
};
