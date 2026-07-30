import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppleMusicError } from "@repo/errors";

const mocks = vi.hoisted(() => ({
  generateDeveloperToken: vi.fn(),
}));

vi.mock("../../../shared/apple-music/token", () => ({
  generateDeveloperToken: mocks.generateDeveloperToken,
}));

import { fetchArtist, fetchSong } from "../../../shared/apple-music/client";

/*
 * テストリスト: Apple Music client (fetchCatalogResource 経由の fetchArtist / fetchSong)
 *
 * 公式 Apple Music API に基づく契約（根拠: Resource / SongsResponse / ArtistsResponse /
 * Handling Resource Representation and Relationships）:
 *   - Resource は id / type を必須持つ。href は公式仕様に存在するが attributes と同様に
 *     subset として扱い、本 client が利用しない href を必須化しない（過剰必須化を避ける）
 *   - type はリソース種別（songs / artists 等）。endpoint と responseSchema で不整合が
 *     起こらないよう、各 endpoint 設定が resource / query / messages / responseSchema を束ねる
 *   - attributes / relationships は部分集合でもよい。relationship 内のアーティストは
 *     identifier-only（id / type のみ、attributes を含まない）も許容する
 *   - SongsResponse / ArtistsResponse の data は (Required)
 *
 * 1. fetchArtist 成功: URL に Bearer トークン付きでリクエスト、data の先頭要素（type: "artists" 含む）を返す
 * 2. fetchSong 成功: URL に ?include=artists が含まれ、type: "songs" 付きの楽曲を返す
 * 3. HTTP 404 → AppleMusicError statusCode 404、notFound メッセージ（artist / song 各々）
 * 4. HTTP 500 → AppleMusicError 502、fetchFailed メッセージ
 * 5. fetch reject → AppleMusicError 502、リクエスト失敗メッセージ、cause 保持
 * 6. response.text() reject → AppleMusicError 502、読み取り失敗メッセージ、cause 保持（非同期境界）
 * 7. malformed JSON → AppleMusicError 502 スキーマ不一致（string.json.parse が ArkErrors に統合）
 * 8. エンベロープ不一致（例: { data: "x" }）→ AppleMusicError 502 スキーマ不一致メッセージ
 * 9. 先頭要素の必須属性欠落（例: attributes.name 無し）→ AppleMusicError 502、arktype summary を含む
 * 10. data: [] 空配列のみ → AppleMusicError 404 notFound メッセージ
 * 11. data 欠落（エンベロープに data 無し）→ AppleMusicError 502 スキーマ不一致メッセージ
 * 12. generateDeveloperToken reject → AppleMusicError 502 トークンメッセージ
 * 13. Apple Music ID の URL エンコード（artist / song 各々）
 * 14. 回帰: アーティスト type 不一致（例: type: "songs"）→ AppleMusicError 502
 * 15. 回帰: 楽曲 type 不一致（例: type: "artists"）→ AppleMusicError 502
 * 16. 回帰: 配列内の不正要素（2件目が不正）→ AppleMusicError 502 スキーマ不一致（配列全体検証）
 */
describe("Apple Music client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateDeveloperToken.mockResolvedValue("header.payload.signature");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchArtist が data の先頭要素を返す（type: artists 含む）", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "artist-1",
              type: "artists",
              href: "/v1/catalog/jp/artists/artist-1",
              attributes: { name: "Test Artist" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchArtist("artist-1");

    expect(result).toMatchObject({
      id: "artist-1",
      type: "artists",
      attributes: { name: "Test Artist" },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.music.apple.com/v1/catalog/jp/artists/artist-1");
    expect(init).toMatchObject({
      headers: { Authorization: "Bearer header.payload.signature" },
    });
  });

  it("fetchSong が URL に ?include=artists を含め、relationships 付きの楽曲を返す", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "song-1",
              type: "songs",
              href: "/v1/catalog/jp/songs/song-1",
              attributes: { name: "Test Song", genreNames: ["Pop"] },
              relationships: {
                artists: {
                  href: "/v1/catalog/jp/songs/song-1/artists",
                  data: [
                    {
                      id: "artist-1",
                      type: "artists",
                      href: "/v1/catalog/jp/artists/artist-1",
                      attributes: { name: "Artist" },
                    },
                  ],
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchSong("song-1");

    expect(result).toMatchObject({
      id: "song-1",
      type: "songs",
      attributes: { name: "Test Song", genreNames: ["Pop"] },
      relationships: {
        artists: {
          data: [{ id: "artist-1", type: "artists" }],
        },
      },
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.music.apple.com/v1/catalog/jp/songs/song-1?include=artists");
  });

  it.each([
    ["artist", fetchArtist, "指定されたアーティストが見つかりません。"],
    ["song", fetchSong, "指定された楽曲が見つかりません。"],
  ] as const)(
    "HTTP 404 → AppleMusicError(404) の %s notFound メッセージ",
    async (_, lookup, message) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));

      const result = await lookup("id-1");

      expect(result).toBeInstanceOf(AppleMusicError);
      expect(result).toMatchObject({ statusCode: 404, message });
    },
  );

  it.each([
    ["artist", fetchArtist, "Apple Music API からアーティスト情報を取得できませんでした。"],
    ["song", fetchSong, "Apple Music API から楽曲情報を取得できませんでした。"],
  ] as const)(
    "HTTP 500 → AppleMusicError(502) の %s fetchFailed メッセージ",
    async (_, lookup, message) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));

      const result = await lookup("id-1");

      expect(result).toBeInstanceOf(AppleMusicError);
      expect(result).toMatchObject({ statusCode: 502, message });
    },
  );

  it("fetch reject → AppleMusicError(502) リクエスト失敗メッセージ、cause 保持", async () => {
    const networkError = new Error("network down");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(networkError);

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({
      statusCode: 502,
      message: "Apple Music API のリクエストに失敗しました。",
    });
    expect((result as AppleMusicError).cause).toBe(networkError);
  });

  it("response.text() reject → AppleMusicError(502) 読み取り失敗メッセージ、cause 保持", async () => {
    const textError = new Error("stream locked");
    const response = new Response("body", { status: 200 });
    vi.spyOn(response, "text").mockRejectedValue(textError);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({
      statusCode: 502,
      message: "Apple Music API レスポンスの読み取りに失敗しました。",
    });
    expect((result as AppleMusicError).cause).toBe(textError);
  });

  it("malformed JSON → AppleMusicError(502) スキーマ不一致 (string.json.parse が ArkErrors に統合)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid json", { status: 200 }));

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    expect((result as AppleMusicError).message).toContain(
      "Apple Music API レスポンスが想定スキーマと一致しません",
    );
  });

  it("エンベロープ不一致 → AppleMusicError(502) スキーマ不一致メッセージ", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: "not-an-array" }), { status: 200 }),
    );

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    expect((result as AppleMusicError).message).toContain(
      "Apple Music API レスポンスが想定スキーマと一致しません",
    );
  });

  it("先頭要素の必須属性欠落 → AppleMusicError(502) arktype summary を含む", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "artist-1", attributes: {} }] }), { status: 200 }),
    );

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    const message = (result as AppleMusicError).message;
    expect(message).toContain("Apple Music API レスポンスが想定スキーマと一致しません");
    expect(message).toContain("name");
  });

  it.each([
    ["artist", fetchArtist, "指定されたアーティストが見つかりません。"],
    ["song", fetchSong, "指定された楽曲が見つかりません。"],
  ] as const)(
    "data 空配列のみ → AppleMusicError(404) の %s notFound メッセージ",
    async (_, lookup, message) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );

      const result = await lookup("id-1");

      expect(result).toBeInstanceOf(AppleMusicError);
      expect(result).toMatchObject({ statusCode: 404, message });
    },
  );

  it.each([
    ["artist", fetchArtist],
    ["song", fetchSong],
  ] as const)(
    "data 欠落（エンベロープに data 無し）→ AppleMusicError(502) スキーマ不一致 (%s)",
    async (_, lookup) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const result = await lookup("id-1");

      expect(result).toBeInstanceOf(AppleMusicError);
      expect(result).toMatchObject({ statusCode: 502 });
      expect((result as AppleMusicError).message).toContain(
        "Apple Music API レスポンスが想定スキーマと一致しません",
      );
    },
  );

  it("generateDeveloperToken reject → AppleMusicError(502) トークンメッセージ", async () => {
    mocks.generateDeveloperToken.mockRejectedValue(new Error("key error"));
    vi.spyOn(globalThis, "fetch");

    const result = await fetchArtist("id-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({
      statusCode: 502,
      message: "Apple Music トークンの生成に失敗しました。",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["artist", fetchArtist, "artists", ""],
    ["song", fetchSong, "songs", "?include=artists"],
  ] as const)("Apple Music ID を URL エンコードする (%s)", async (_, lookup, resource, query) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "id/with space",
              type: resource,
              attributes: { name: "Name", genreNames: [] },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await lookup("id/with space");

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://api.music.apple.com/v1/catalog/jp/${resource}/id%2Fwith%20space${query}`,
    );
  });

  it("回帰: アーティスト type 不一致 → AppleMusicError(502)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "artist-1", type: "songs", attributes: { name: "Test Artist" } }],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchArtist("artist-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    expect((result as AppleMusicError).message).toContain(
      "Apple Music API レスポンスが想定スキーマと一致しません",
    );
    expect((result as AppleMusicError).message).toContain("type");
  });

  it("回帰: 楽曲 type 不一致 → AppleMusicError(502)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "song-1",
              type: "artists",
              attributes: { name: "Test Song", genreNames: ["Pop"] },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchSong("song-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    expect((result as AppleMusicError).message).toContain(
      "Apple Music API レスポンスが想定スキーマと一致しません",
    );
    expect((result as AppleMusicError).message).toContain("type");
  });

  it("回帰: 配列内の不正要素（2件目が不正）→ AppleMusicError(502) スキーマ不一致", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "artist-1", type: "artists", attributes: { name: "Valid Artist" } },
            { id: "artist-2", type: "artists" },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchArtist("artist-1");

    expect(result).toBeInstanceOf(AppleMusicError);
    expect(result).toMatchObject({ statusCode: 502 });
    expect((result as AppleMusicError).message).toContain(
      "Apple Music API レスポンスが想定スキーマと一致しません",
    );
    expect((result as AppleMusicError).message).toContain("attributes");
  });
});
