import type { z } from "zod";
import {
  AppleArtistNotFoundError,
  AppleMusicRateLimitError,
  AppleMusicRequestError,
  AppleSongNotFoundError,
  type FetchCatalogArtistError,
  type FetchCatalogSongError,
  SongWithoutIsrcError,
} from "./errors.ts";
import { catalogArtistsResponse, catalogSongsResponse } from "./schemas.ts";

// ストアフロントと言語は jp・日本語に固定する（設計ドキュメントの決定 25）。
const API_BASE = "https://api.music.apple.com/v1";
const STOREFRONT = "jp";
const LANGUAGE = "ja";

type Fetch = typeof globalThis.fetch;

/**
 * カタログの API を呼び、応答を schema で検証する。404 のときは null を返す。
 * それ以外の失敗は、レート制限（429）とそれ以外に分けてエラーとして返す。
 */
async function requestCatalog<Schema extends z.ZodType>({
  path,
  query,
  schema,
  developerToken,
  fetch,
}: {
  path: string;
  query: Record<string, string>;
  schema: Schema;
  developerToken: string;
  fetch: Fetch;
}) {
  const url = `${API_BASE}${path}?${new URLSearchParams({ ...query, l: LANGUAGE }).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${developerToken}` } }).catch(
    (e) => new AppleMusicRequestError({ path, cause: e }),
  );
  if (res instanceof Error) return res;
  if (res.status === 404) return null;
  if (res.status === 429) return new AppleMusicRateLimitError();
  if (!res.ok) return new AppleMusicRequestError({ path, cause: new Error(`HTTP ${res.status}`) });

  const parsed = await res
    .json()
    .then((body) => schema.safeParse(body))
    .catch((e) => new AppleMusicRequestError({ path, cause: e }));
  if (parsed instanceof Error) return parsed;
  if (!parsed.success) return new AppleMusicRequestError({ path, cause: parsed.error });
  return parsed.data as z.output<Schema>;
}

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

/** Apple Music のカタログ ID で曲を 1 つ取得する。アーティストの ID も一緒に取る。 */
export async function fetchCatalogSong({
  songId,
  developerToken,
  fetch = globalThis.fetch,
}: {
  songId: string;
  developerToken: string;
  fetch?: Fetch;
}): Promise<FetchCatalogSongError | CatalogSong> {
  const body = await requestCatalog({
    path: `/catalog/${STOREFRONT}/songs/${encodeURIComponent(songId)}`,
    query: { include: "artists" },
    schema: catalogSongsResponse,
    developerToken,
    fetch,
  });
  if (body instanceof Error) return body;

  const song = body?.data[0];
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

/** Apple Music のカタログから取得したアーティスト。artists テーブルの列に合わせた形。 */
export type CatalogArtist = {
  id: string;
  name: string | null;
  artworkUrl: string | null;
  url: string | null;
};

/** Apple Music のアーティスト ID でアーティストを 1 つ取得する。 */
export async function fetchCatalogArtist({
  artistId,
  developerToken,
  fetch = globalThis.fetch,
}: {
  artistId: string;
  developerToken: string;
  fetch?: Fetch;
}): Promise<FetchCatalogArtistError | CatalogArtist> {
  const body = await requestCatalog({
    path: `/catalog/${STOREFRONT}/artists/${encodeURIComponent(artistId)}`,
    query: {},
    schema: catalogArtistsResponse,
    developerToken,
    fetch,
  });
  if (body instanceof Error) return body;

  const artist = body?.data[0];
  if (!artist) return new AppleArtistNotFoundError({ artistId });

  return {
    id: artist.id,
    name: artist.attributes.name ?? null,
    artworkUrl: artist.attributes.artwork?.url ?? null,
    url: artist.attributes.url ?? null,
  };
}
