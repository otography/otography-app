import * as errore from "errore";
import { z } from "zod";

// ストアフロントと言語は jp・日本語に固定する（設計ドキュメントの決定 25）。
const API_BASE = "https://api.music.apple.com/v1";
const STOREFRONT = "jp";
const LANGUAGE = "ja";

export class AppleMusicRequestError extends errore.createTaggedError({
  name: "AppleMusicRequestError",
  message: "Apple Music API へのリクエストが失敗しました（$path）",
}) {}

export class AppleMusicRateLimitError extends errore.createTaggedError({
  name: "AppleMusicRateLimitError",
  message:
    "Apple Music API のリクエスト数の上限を超えました。しばらく待ってから、もう一度試してください",
}) {}

export class AppleSongNotFoundError extends errore.createTaggedError({
  name: "AppleSongNotFoundError",
  message: "Apple Music に曲 $songId が見つかりません。曲を検索し直してください",
}) {}

export class SongWithoutIsrcError extends errore.createTaggedError({
  name: "SongWithoutIsrcError",
  message: "曲 $songId には ISRC がないので選べません。別の曲を選んでください",
}) {}

// 使う属性だけを検証する。表示用の属性は、欠けていても保存できるように省略可にする。
const catalogSongsResponse = z.object({
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

/** Apple Music のカタログから取得した曲。songs テーブルの列に合わせた形。 */
export type CatalogSong = {
  isrc: string;
  appleSongId: string;
  title: string | null;
  artistName: string | null;
  albumName: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  url: string | null;
  artistIds: string[];
};

export type FetchCatalogSongError =
  | AppleMusicRequestError
  | AppleMusicRateLimitError
  | AppleSongNotFoundError
  | SongWithoutIsrcError;

/** Apple Music のカタログ ID で曲を 1 つ取得する。アーティストの ID も一緒に取る。 */
export async function fetchCatalogSong({
  songId,
  developerToken,
  fetch = globalThis.fetch,
}: {
  songId: string;
  developerToken: string;
  fetch?: typeof globalThis.fetch;
}): Promise<FetchCatalogSongError | CatalogSong> {
  const path = `/catalog/${STOREFRONT}/songs/${encodeURIComponent(songId)}`;
  const url = `${API_BASE}${path}?include=artists&l=${LANGUAGE}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${developerToken}` } }).catch(
    (e) => new AppleMusicRequestError({ path, cause: e }),
  );
  if (res instanceof Error) return res;
  if (res.status === 404) return new AppleSongNotFoundError({ songId });
  if (res.status === 429) return new AppleMusicRateLimitError();
  if (!res.ok) return new AppleMusicRequestError({ path, cause: new Error(`HTTP ${res.status}`) });

  const parsed = await res
    .json()
    .then((body) => catalogSongsResponse.safeParse(body))
    .catch((e) => new AppleMusicRequestError({ path, cause: e }));
  if (parsed instanceof Error) return parsed;
  if (!parsed.success) return new AppleMusicRequestError({ path, cause: parsed.error });

  const song = parsed.data.data[0];
  if (!song) return new AppleSongNotFoundError({ songId });

  const { attributes } = song;
  if (!attributes.isrc) return new SongWithoutIsrcError({ songId });

  return {
    isrc: attributes.isrc.toUpperCase(),
    appleSongId: song.id,
    title: attributes.name ?? null,
    artistName: attributes.artistName ?? null,
    albumName: attributes.albumName ?? null,
    durationMs: attributes.durationInMillis ?? null,
    artworkUrl: attributes.artwork?.url ?? null,
    url: attributes.url ?? null,
    artistIds: song.relationships?.artists.data.map((artist) => artist.id) ?? [],
  };
}
