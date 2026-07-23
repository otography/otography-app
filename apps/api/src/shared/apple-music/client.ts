import { DbError } from "@repo/errors";
import { generateDeveloperToken } from "./token";

// Apple Music API のアーティスト情報
type AppleMusicArtist = {
  id: string;
  attributes: {
    name: string;
  };
};

// Apple Music API の楽曲情報（include=artists 時に attributes も取得）
type AppleMusicSongArtist = {
  id: string;
  type: "artists";
  attributes?: {
    name: string;
  };
};

// Apple Music API の楽曲情報
type AppleMusicSong = {
  id: string;
  attributes: {
    name: string;
    durationInMillis?: number;
    isrc?: string;
    genreNames: string[];
  };
  relationships?: {
    artists?: {
      data?: AppleMusicSongArtist[];
    };
  };
};

type CatalogResource = "artists" | "songs";

type CatalogLookupOptions = {
  resource: CatalogResource;
  appleMusicId: string;
  query?: string;
  notFoundMessage: string;
  unavailableMessage: string;
};

// Apple Music Catalog API の lookup 共通契約
const fetchCatalogResource = async <T>({
  resource,
  appleMusicId,
  query = "",
  notFoundMessage,
  unavailableMessage,
}: CatalogLookupOptions) => {
  const token = await generateDeveloperToken().catch(
    (e) =>
      new DbError({
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
      new DbError({
        message: "Apple Music API のリクエストに失敗しました。",
        statusCode: 502,
        cause: e,
      }),
  );

  if (response instanceof Error) return response;

  if (!response.ok) {
    if (response.status === 404) {
      return new DbError({
        message: notFoundMessage,
        statusCode: 404,
      });
    }
    return new DbError({
      message: unavailableMessage,
      statusCode: 502,
    });
  }

  const body = await response.json().catch(
    (e) =>
      new DbError({
        message: "Apple Music API レスポンスのパースに失敗しました。",
        statusCode: 502,
        cause: e,
      }),
  );
  if (body instanceof Error) return body;

  const item = (body as { data?: T[] }).data?.[0];
  if (!item) {
    return new DbError({
      message: notFoundMessage,
      statusCode: 404,
    });
  }

  return item;
};

// アーティストを lookup で取得
export const fetchArtist = (appleMusicId: string) =>
  fetchCatalogResource<AppleMusicArtist>({
    resource: "artists",
    appleMusicId,
    notFoundMessage: "指定されたアーティストが見つかりません。",
    unavailableMessage: "Apple Music API からアーティスト情報を取得できませんでした。",
  });

// 楽曲を lookup で取得
export const fetchSong = (appleMusicId: string) =>
  fetchCatalogResource<AppleMusicSong>({
    resource: "songs",
    appleMusicId,
    query: "?include=artists",
    notFoundMessage: "指定された楽曲が見つかりません。",
    unavailableMessage: "Apple Music API から楽曲情報を取得できませんでした。",
  });
