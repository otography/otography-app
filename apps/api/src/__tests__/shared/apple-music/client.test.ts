import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateDeveloperToken: vi.fn(),
}));

vi.mock("../../../shared/apple-music/token", () => ({
  generateDeveloperToken: mocks.generateDeveloperToken,
}));

import { fetchArtist, fetchSong } from "../../../shared/apple-music/client";

describe("Apple Music client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateDeveloperToken.mockResolvedValue("header.payload.signature");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["artist", fetchArtist, "artists", ""],
    ["song", fetchSong, "songs", "?include=artists"],
  ] as const)("encodes the Apple Music ID for %s lookups", async (_, lookup, resource, query) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "id/with space", attributes: { name: "Name", genreNames: [] } }],
        }),
        { status: 200 },
      ),
    );

    await lookup("id/with space");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://api.music.apple.com/v1/catalog/jp/${resource}/id%2Fwith%20space${query}`,
    );
    expect(init).toMatchObject({
      headers: { Authorization: expect.stringMatching(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/) },
    });
  });

  it.each([
    ["artist", fetchArtist, { data: [{ id: "artist-1", attributes: {} }] }],
    [
      "song",
      fetchSong,
      { data: [{ id: "song-1", attributes: { name: "Song", genreNames: "Pop" } }] },
    ],
  ] as const)("rejects an invalid %s response", async (_, lookup, body) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );

    const result = await lookup("resource-1");

    expect(result).toBeInstanceOf(Error);
    expect(result).toMatchObject({
      message: "Apple Music API レスポンスの形式が不正です。",
      statusCode: 502,
    });
  });
});
