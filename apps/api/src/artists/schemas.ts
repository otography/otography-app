import { artists } from "db";
import { createSelectSchema } from "drizzle-orm/zod";

/** 応答に含めるアーティストの項目。 */
export const artistOutput = createSelectSchema(artists).pick({
  id: true,
  name: true,
  artworkUrl: true,
  url: true,
});
