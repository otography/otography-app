import type { InferSelectModel } from "drizzle-orm";
import { songs } from "../../shared/db/schema";

type SongDbModel = InferSelectModel<typeof songs>;

export type Song = {
  id: SongDbModel["id"];
  title: SongDbModel["title"];
  length: SongDbModel["length"];
  isrcs: SongDbModel["isrcs"];
};

export const toSong = (model: SongDbModel): Song => {
  return {
    id: model.id,
    title: model.title,
    length: model.length,
    isrcs: model.isrcs,
  };
};
