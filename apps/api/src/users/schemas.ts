import { FAVORITE_LIMIT, artists, favoriteArtists, favoriteSongs, songs, users } from "db";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { artistOutput } from "../artists/schemas.ts";
import { songOutput } from "../songs/schemas.ts";

/**
 * GET /api/me が返す項目。users の列の型から作る。
 * pick に無い列（内部 ID、利用停止・退会の日時など）は、parse したときに取り除かれる。
 */
export const meSchema = createSelectSchema(users).pick({
  name: true,
  email: true,
  image: true,
  publicId: true,
  bio: true,
  isAdmin: true,
});

/** PATCH /api/me の入力。送られた項目だけを変える。自己紹介を空にすると NULL にする。 */
export const updateProfileInput = createInsertSchema(users, {
  name: (schema) => schema.trim().min(1),
  bio: (schema) => schema.trim().transform((value) => value || null),
})
  .pick({ name: true, bio: true })
  .partial();

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

/** 絵文字が 1 つだけか。肌の色や結合（家族の絵文字など）を含めて、見た目で 1 文字の絵文字を 1 つと数える。 */
const isSingleEmoji = (value: string) =>
  Array.from(graphemes.segment(value)).length === 1 &&
  /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value);

const favoriteSongInsert = createInsertSchema(favoriteSongs, {
  comment: (schema) => schema.trim().transform((value) => value || null),
  emoji: (schema) => schema.refine(isSingleEmoji, "絵文字は 1 つだけ選べます"),
});
const songInsert = createInsertSchema(songs);

const favoriteArtistInsert = createInsertSchema(favoriteArtists, {
  comment: (schema) => schema.trim().transform((value) => value || null),
  emoji: (schema) => schema.refine(isSingleEmoji, "絵文字は 1 つだけ選べます"),
});
const artistInsert = createInsertSchema(artists);

/** PUT /api/me/favorite-artists の入力。配列の順がそのまま並び順になる。 */
export const replaceFavoriteArtistsInput = z.object({
  items: z
    .array(
      favoriteArtistInsert
        .pick({ comment: true, emoji: true, color: true })
        .extend({ artistId: artistInsert.shape.id }),
    )
    .max(FAVORITE_LIMIT),
});

/** PUT /api/me/favorite-songs の入力。配列の順がそのまま並び順になる。 */
export const replaceFavoriteSongsInput = z.object({
  items: z
    .array(
      favoriteSongInsert.pick({ comment: true, emoji: true, color: true }).extend({
        songId: songInsert.shape.appleSongId,
        isrc: songInsert.shape.isrc,
      }),
    )
    .max(FAVORITE_LIMIT),
});

const favoriteOutput = createSelectSchema(favoriteSongs).pick({
  comment: true,
  emoji: true,
  color: true,
});

/** GET /api/users/:publicId が返すプロフィール。メールアドレスや内部 ID は含めない。 */
export const profileOutput = createSelectSchema(users)
  .pick({ publicId: true, name: true, bio: true, image: true })
  .extend({
    favoriteSongs: z.array(favoriteOutput.extend({ song: songOutput })),
    favoriteArtists: z.array(
      createSelectSchema(favoriteArtists)
        .pick({ comment: true, emoji: true, color: true })
        .extend({ artist: artistOutput }),
    ),
  });
