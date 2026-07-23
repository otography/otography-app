import { beforeEach, describe, expect, it, vi } from "vitest";

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
    mocks.generateDeveloperToken.mockResolvedValue("developer-token");
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

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.music.apple.com/v1/catalog/jp/${resource}/id%2Fwith%20space${query}`,
      {
        headers: { Authorization: "Bearer developer-token" },
      },
    );
  });
});
