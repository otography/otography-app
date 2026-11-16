import { describe, expect, test } from "vite-plus/test";
import { fetchCatalogSong } from "../../../src/lib/apple-music/catalog.ts";
import {
  AppleMusicRateLimitError,
  AppleMusicRequestError,
  AppleSongNotFoundError,
  SongWithoutIsrcError,
} from "../../../src/lib/apple-music/errors.ts";

const songResponse = (attributes: Record<string, unknown>) => ({
  data: [
    {
      id: "1440857781",
      type: "songs",
      attributes: {
        name: "曲名",
        artistName: "A & B",
        albumName: "アルバム",
        durationInMillis: 215000,
        artwork: { url: "https://example.com/{w}x{h}bb.jpg" },
        url: "https://music.apple.com/jp/song/1440857781",
        isrc: "jpab01234567",
        ...attributes,
      },
      relationships: { artists: { data: [{ id: "a1" }, { id: "a2" }] } },
    },
  ],
});

const respond =
  (status: number, body: unknown = {}): typeof fetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe("fetchCatalogSong", () => {
  test("jp のストアフロントに、開発者トークンと include=artists を付けて問い合わせる", async () => {
    const requests: Request[] = [];
    const song = await fetchCatalogSong({
      songId: "1440857781",
      developerToken: "token",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify(songResponse({})));
      },
    });

    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe("/v1/catalog/jp/songs/1440857781");
    expect(url.searchParams.get("include")).toBe("artists");
    expect(url.searchParams.get("l")).toBe("ja");
    expect(requests[0]!.headers.get("Authorization")).toBe("Bearer token");
    expect(song).toEqual({
      isrc: "JPAB01234567",
      appleSongId: "1440857781",
      title: "曲名",
      artistName: "A & B",
      albumName: "アルバム",
      durationMs: 215000,
      artworkUrl: "https://example.com/{w}x{h}bb.jpg",
      url: "https://music.apple.com/jp/song/1440857781",
      artistIds: ["a1", "a2"],
    });
  });

  test("Apple の応答の状態ごとに、別のエラーを返す", async () => {
    const call = (fetch: typeof globalThis.fetch) =>
      fetchCatalogSong({ songId: "1", developerToken: "token", fetch });

    expect(await call(respond(404))).toBeInstanceOf(AppleSongNotFoundError);
    expect(await call(respond(200, { data: [] }))).toBeInstanceOf(AppleSongNotFoundError);
    expect(await call(respond(429))).toBeInstanceOf(AppleMusicRateLimitError);
    expect(await call(respond(500))).toBeInstanceOf(AppleMusicRequestError);
    expect(await call(respond(200, { unexpected: true }))).toBeInstanceOf(AppleMusicRequestError);
    expect(await call(respond(200, songResponse({ isrc: undefined })))).toBeInstanceOf(
      SongWithoutIsrcError,
    );
    expect(
      await call(async () => {
        throw new TypeError("network");
      }),
    ).toBeInstanceOf(AppleMusicRequestError);
  });
});
