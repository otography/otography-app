import { z } from "zod";

// 使う属性だけを検証する。表示用の属性は、欠けていても保存できるように省略可にする。
export const catalogSongsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      attributes: z.object({
        name: z.string().optional(),
        artistName: z.string().optional(),
        albumName: z.string().optional(),
        durationInMillis: z.number().optional(),
        artwork: z.object({ url: z.string() }).optional(),
        url: z.string().optional(),
        isrc: z.string().optional(),
      }),
      relationships: z
        .object({ artists: z.object({ data: z.array(z.object({ id: z.string() })) }) })
        .optional(),
    }),
  ),
});

/** アーティストの取得（/v1/catalog/{storefront}/artists/{id}）の応答。使う属性だけを検証する。 */
export const catalogArtistsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      attributes: z.object({
        name: z.string().optional(),
        artwork: z.object({ url: z.string() }).optional(),
        url: z.string().optional(),
      }),
    }),
  ),
});
