import { AppleMusicError } from "@repo/errors";
import { type, type ArkErrors } from "arktype";
import { generateDeveloperToken } from "./token";

// Apple Music API のアーティスト情報
const appleMusicArtistSchema = type({
  id: "string",
  attributes: { name: "string" },
});

// Apple Music API の楽曲情報（include=artists 時に relationships も取得）
const appleMusicSongArtistSchema = type({
  id: "string",
  type: "'artists'",
  "attributes?": { name: "string" },
});

// Apple Music API の楽曲情報
const appleMusicSongSchema = type({
  id: "string",
  attributes: {
    name: "string",
    "durationInMillis?": "number",
    "isrc?": "string",
    genreNames: "string[]",
  },
  "relationships?": {
    "artists?": {
      "data?": appleMusicSongArtistSchema.array(),
    },
  },
});

// Apple Music Catalog API の共通エンベロープ
const catalogEnvelopeSchema = type({ "data?": "unknown[]" });

type AppleMusicArtist = typeof appleMusicArtistSchema.infer;
type AppleMusicSong = typeof appleMusicSongSchema.infer;

type CatalogResource = "artists" | "songs";

type CatalogLookupOptions<T> = {
  resource: CatalogResource;
  appleMusicId: string;
  query?: string;
  notFoundMessage: string;
  unavailableMessage: string;
  schema: (input: unknown) => T | ArkErrors;
};

// Apple Music Catalog API の lookup 共通契約
const fetchCatalogResource = async <T>({
  resource,
  appleMusicId,
  query = "",
  notFoundMessage,
  unavailableMessage,
  schema,
}: CatalogLookupOptions<T>): Promise<T | AppleMusicError> => {
  const token = await generateDeveloperToken().catch(
    (e) =>
      new AppleMusicError({
        message: "Apple Music トークンの生成に失敗しました。",
        statusCode: 502,
        cause: e,
      }),
  );
  if (token instanceof Error) return token;

  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/jp/${resource}/${encodeURIComponent(appleMusicId)}${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  ).catch(
    (e) =>
      new AppleMusicError({
        message: "Apple Music API のリクエストに失敗しました。",
        statusCode: 502,
        cause: e,
      }),
  );
  if (response instanceof Error) return response;

  if (!response.ok) {
    if (response.status === 404) {
      return new AppleMusicError({ message: notFoundMessage, statusCode: 404 });
    }
    return new AppleMusicError({ message: unavailableMessage, statusCode: 502 });
  }

  const body = await response.json().catch(
    (e) =>
      new AppleMusicError({
        message: "Apple Music API レスポンスのパースに失敗しました。",
        statusCode: 502,
        cause: e,
      }) as unknown as Promise<unknown>,
  );
  if (body instanceof AppleMusicError) return body;

  // エンベロープ検証
  const envelope = catalogEnvelopeSchema(body);
  if (envelope instanceof type.errors) {
    return new AppleMusicError({
      message: `Apple Music API レスポンスが想定スキーマと一致しません: ${envelope.summary}`,
      statusCode: 502,
      cause: envelope,
    });
  }

  // 先頭要素の有無（data 欠落・空配列）
  const first = envelope.data?.[0];
  if (!first) {
    return new AppleMusicError({ message: notFoundMessage, statusCode: 404 });
  }

  // リソース別スキーマ検証
  const parsed = schema(first);
  if (parsed instanceof type.errors) {
    return new AppleMusicError({
      message: `Apple Music API レスポンスが想定スキーマと一致しません: ${parsed.summary}`,
      statusCode: 502,
      cause: parsed,
    });
  }

  return parsed;
};

// アーティストを lookup で取得
export const fetchArtist = (appleMusicId: string) =>
  fetchCatalogResource<AppleMusicArtist>({
    resource: "artists",
    appleMusicId,
    notFoundMessage: "指定されたアーティストが見つかりません。",
    unavailableMessage: "Apple Music API からアーティスト情報を取得できませんでした。",
    schema: appleMusicArtistSchema,
  });

// 楽曲を lookup で取得
export const fetchSong = (appleMusicId: string) =>
  fetchCatalogResource<AppleMusicSong>({
    resource: "songs",
    appleMusicId,
    query: "?include=artists",
    notFoundMessage: "指定された楽曲が見つかりません。",
    unavailableMessage: "Apple Music API から楽曲情報を取得できませんでした。",
    schema: appleMusicSongSchema,
  });
