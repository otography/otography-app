import { AppleMusicError } from "@repo/errors";
import { type } from "arktype";
import { generateDeveloperToken } from "./token";

// Apple Music API のアーティスト情報
// 公式 Resource 仕様: type は必須（アーティストは常に "artists"）。
// attributes は部分集合でもよいため、利用する項目のみ必須化する。
// href は公式仕様に存在するが本 client では利用しないので必須化しない。
const appleMusicArtistSchema = type({
  id: "string",
  type: "'artists'",
  attributes: { name: "string" },
});

// Apple Music API の楽曲情報（include=artists 時に relationships も取得）
// relationship 内のアーティストは identifier-only（id / type のみ）も許容する。
const appleMusicSongArtistSchema = type({
  id: "string",
  type: "'artists'",
  "attributes?": { name: "string" },
});

// Apple Music API の楽曲情報
// 公式 Resource 仕様: type は必須（楽曲は常に "songs"）。
const appleMusicSongSchema = type({
  id: "string",
  type: "'songs'",
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

// 各 endpoint のレスポンス検証: type("string.json.parse").to(...) で
// JSON 文字列パースと endpoint 固有の data 配列検証を一回の schema 適用に統合する。
// malformed JSON は string.json.parse が ctx.error 経由で ArkErrors に変換し、
// schema mismatch (502) として扱う。data 欠落・wrong resource type・配列内の不正要素も
// 同じ endpoint response schema で拒否される。
const artistResponseSchema = type("string.json.parse").to({
  data: appleMusicArtistSchema.array(),
});

const songResponseSchema = type("string.json.parse").to({
  data: appleMusicSongSchema.array(),
});

// endpoint 定義: resource literal を key とし、query / messages / responseSchema を
// 一つの mapping に束ねる。resource と responseSchema は同一の ENDPOINT_MAP エントリから
// 導かれるため、artists endpoint へ song schema を渡すような組み合わせ不整合は型上で排除される。
const ENDPOINT_MAP = {
  artists: {
    query: "",
    notFoundMessage: "指定されたアーティストが見つかりません。",
    unavailableMessage: "Apple Music API からアーティスト情報を取得できませんでした。",
    responseSchema: artistResponseSchema,
  },
  songs: {
    query: "?include=artists",
    notFoundMessage: "指定された楽曲が見つかりません。",
    unavailableMessage: "Apple Music API から楽曲情報を取得できませんでした。",
    responseSchema: songResponseSchema,
  },
};

type EndpointKey = keyof typeof ENDPOINT_MAP;

// responseSchema の inferred output から data 要素型を自動導出する。
// 手動 generic T を使わず、schema から結果型を導く。
type EndpointResult<K extends EndpointKey> =
  (typeof ENDPOINT_MAP)[K]["responseSchema"]["infer"]["data"][number];

// Apple Music Catalog API の lookup 共通契約。
// resource は ENDPOINT_MAP の key に制約されるため、resource と responseSchema を
// 独立に組み合わせることはできない。
const fetchCatalogResource = async <K extends EndpointKey>(
  resource: K,
  appleMusicId: string,
): Promise<EndpointResult<K> | AppleMusicError> => {
  const config = ENDPOINT_MAP[resource];
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
    `https://api.music.apple.com/v1/catalog/jp/${resource}/${encodeURIComponent(appleMusicId)}${config.query}`,
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
      return new AppleMusicError({ message: config.notFoundMessage, statusCode: 404 });
    }
    return new AppleMusicError({ message: config.unavailableMessage, statusCode: 502 });
  }

  // response.text() の rejection は非同期境界なので cause 付き AppleMusicError 値に変換し、
  // throw しない（errore convention）。
  const text = await response.text().catch(
    (e) =>
      new AppleMusicError({
        message: "Apple Music API レスポンスの読み取りに失敗しました。",
        statusCode: 502,
        cause: e,
      }),
  );
  if (text instanceof AppleMusicError) return text;

  // JSON パース + endpoint 固有レスポンス検証を一回の schema 適用に統合。
  // malformed JSON は string.json.parse が ArkErrors に変換する。
  const parsed = config.responseSchema(text);
  if (parsed instanceof type.errors) {
    return new AppleMusicError({
      message: `Apple Music API レスポンスが想定スキーマと一致しません: ${parsed.summary}`,
      statusCode: 502,
      cause: parsed,
    });
  }

  // data 空配列のみ 404。data 欠落・型不一致は上記 schema 検証で 502。
  const first = parsed.data[0];
  if (!first) {
    return new AppleMusicError({ message: config.notFoundMessage, statusCode: 404 });
  }

  return first;
};

// アーティストを lookup で取得
export const fetchArtist = (appleMusicId: string) => fetchCatalogResource("artists", appleMusicId);

// 楽曲を lookup で取得
export const fetchSong = (appleMusicId: string) => fetchCatalogResource("songs", appleMusicId);
