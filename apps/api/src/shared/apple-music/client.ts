import { DbError } from "@repo/errors";
import { generateDeveloperToken } from "./token";

// Apple Music API のアーティスト情報
type AppleMusicArtist = {
  id: string;
  attributes: {
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
  };
};

// アーティストを lookup で取得
export const fetchArtist = async (appleMusicId: string) => {
  const token = await generateDeveloperToken();
  const storefront = "jp";

  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/${storefront}/artists/${appleMusicId}`,
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
        message: "指定されたアーティストが見つかりません。",
        statusCode: 404,
      });
    }
    return new DbError({
      message: "Apple Music API からアーティスト情報を取得できませんでした。",
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

  const artist = (body as { data?: AppleMusicArtist[] }).data?.[0];
  if (!artist) {
    return new DbError({
      message: "指定されたアーティストが見つかりません。",
      statusCode: 404,
    });
  }

  return artist;
};

// 楽曲を lookup で取得
export const fetchSong = async (appleMusicId: string) => {
  const token = await generateDeveloperToken();
  const storefront = "jp";

  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/${storefront}/songs/${appleMusicId}`,
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
        message: "指定された楽曲が見つかりません。",
        statusCode: 404,
      });
    }
    return new DbError({
      message: "Apple Music API から楽曲情報を取得できませんでした。",
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

  const song = (body as { data?: AppleMusicSong[] }).data?.[0];
  if (!song) {
    return new DbError({
      message: "指定された楽曲が見つかりません。",
      statusCode: 404,
    });
  }

  return song;
};
