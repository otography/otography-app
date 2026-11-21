import { describe, expect, test } from "vite-plus/test";
import { fetchCatalogArtist } from "../../../src/lib/apple-music/catalog.ts";
import {
  AppleArtistNotFoundError,
  AppleMusicRateLimitError,
} from "../../../src/lib/apple-music/errors.ts";

const respond =
  (status: number, body: unknown = {}): typeof fetch =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe("fetchCatalogArtist", () => {
  test("jp のストアフロントからアーティストを取得し、artists の列の形にする", async () => {
    const urls: Array<string> = [];
    const artist = await fetchCatalogArtist({
      artistId: "1490256993",
      developerToken: "token",
      fetch: async (input: RequestInfo | URL) => {
        urls.push(new Request(input).url);
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "1490256993",
                attributes: {
                  name: "YOASOBI",
                  artwork: { url: "https://example.com/{w}x{h}bb.jpg" },
                  url: "https://music.apple.com/jp/artist/yoasobi/1490256993",
                },
              },
            ],
          }),
        );
      },
    });

    expect(new URL(urls[0]).pathname).toBe("/v1/catalog/jp/artists/1490256993");
    expect(artist).toEqual({
      id: "1490256993",
      name: "YOASOBI",
      artworkUrl: "https://example.com/{w}x{h}bb.jpg",
      url: "https://music.apple.com/jp/artist/yoasobi/1490256993",
    });
  });

  test("404 と 429 を区別して返す", async () => {
    expect(
      await fetchCatalogArtist({ artistId: "1", developerToken: "token", fetch: respond(404) }),
    ).toBeInstanceOf(AppleArtistNotFoundError);
    expect(
      await fetchCatalogArtist({ artistId: "1", developerToken: "token", fetch: respond(429) }),
    ).toBeInstanceOf(AppleMusicRateLimitError);
  });
});
