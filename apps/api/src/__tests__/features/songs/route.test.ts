import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { testRequest } from "../../helpers/test-client";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

vi.mock("../../../shared/middleware", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/middleware")>(
    "../../../shared/middleware",
  );

  return {
    ...actual,
    csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    requireAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => await next(),
  };
});

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

vi.mock("../../../shared/apple-music", () => ({
  fetchSong: vi.fn(),
}));

import { createDb } from "../../../shared/db";
import { fetchSong } from "../../../shared/apple-music";

const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    ...txMethods,
    transaction: vi.fn(async (fn) => fn(txMethods)),
  } as never);
};

describe("songs endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/songs returns songs list", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
                title: "Sample Song",
                length: 180,
                isrcs: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      songs: [
        {
          id: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
          title: "Sample Song",
          length: 180,
          isrcs: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("GET /api/songs/:id returns song", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
                title: "Detail Song",
                length: 210,
                isrcs: "JPABC240001",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222223");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      song: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
        title: "Detail Song",
        length: 210,
        isrcs: "JPABC240001",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("GET /api/songs/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/songs/not-uuid");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song id." });
  });

  it("GET /api/songs/:id returns 404 when not found", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222224");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Song not found." });
  });

  it("POST /api/songs creates song from appleMusicId", async () => {
    vi.mocked(fetchSong).mockResolvedValue({
      id: "am-new-song-1",
      attributes: {
        name: "New Song",
        durationInMillis: 240000,
        isrc: "JPABC2400001",
        genreNames: ["J-Pop", "Pop"],
      },
      relationships: {
        artists: {
          data: [{ id: "am-artist-1", type: "artists", attributes: { name: "Artist One" } }],
        },
      },
    });

    // Drizzle: select().from(table).where(...).limit(...) or await select().from(table).where(...)
    // from() の返り値が thenable であり、かつ where/limit メソッドも持つ
    const queryable = (resolvedValue: unknown) => {
      const obj: Record<string, unknown> = {
        where: vi.fn(() => obj),
        limit: vi.fn(() => obj),
        then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
      };
      return obj;
    };

    const selectFrom = vi
      .fn()
      // findActiveArtistByAppleMusicId（resolveArtistIds、db直）
      .mockReturnValueOnce(queryable([{ id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111" }]))
      // findOrCreateGenreIds（ジャンルID検索、トランザクション内）
      .mockReturnValueOnce(queryable([{ id: "genre-id-1" }, { id: "genre-id-2" }]));

    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: selectFrom,
      })),
      insert: vi
        .fn()
        // 1. songs INSERT
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
                title: "New Song",
                appleMusicId: "am-new-song-1",
                length: 240,
                isrcs: "JPABC2400001",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })
        // 2. songArtists INSERT (syncSongArtists)
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined),
        })
        // 3. genres INSERT (findOrCreateGenreIds) - values → onConflictDoNothing
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })
        // 4. songGenres INSERT (syncSongGenres)
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {
        appleMusicId: "am-new-song-1",
      },
    });

    expect(res.status).toBe(201);
    expect(fetchSong).toHaveBeenCalledWith("am-new-song-1");
  });

  it("POST /api/songs auto-creates unknown artists", async () => {
    vi.mocked(fetchSong).mockResolvedValue({
      id: "am-new-song-2",
      attributes: {
        name: "New Song with New Artist",
        durationInMillis: 200000,
        isrc: null,
        genreNames: [],
      },
      relationships: {
        artists: {
          data: [
            { id: "am-artist-unknown", type: "artists", attributes: { name: "Unknown Artist" } },
          ],
        },
      },
    });

    const queryable = (resolvedValue: unknown) => {
      const obj: Record<string, unknown> = {
        where: vi.fn(() => obj),
        limit: vi.fn(() => obj),
        then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
      };
      return obj;
    };

    // findActiveArtistByAppleMusicId → 空配列（未登録）
    // findOrCreateGenreIds → 空配列（genreNames無し）
    const selectFrom = vi.fn().mockReturnValueOnce(queryable([]));

    const insert = vi
      .fn()
      // 1. artists INSERT（自動作成）
      .mockReturnValueOnce({
        values: vi.fn(() => ({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "auto-created-artist-id", name: "Unknown Artist" }]),
        })),
      })
      // 2. songs INSERT
      .mockReturnValueOnce({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "8f648f36-5be1-4af1-bf5d-cf8ebf222230",
              title: "New Song with New Artist",
              appleMusicId: "am-new-song-2",
              length: 200,
              isrcs: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        })),
      })
      // 3. songArtists INSERT
      .mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: selectFrom,
      })),
      insert,
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: { appleMusicId: "am-new-song-2" },
    });

    expect(res.status).toBe(201);
    // artists INSERT + songs INSERT + songArtists INSERT = 3回
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("POST /api/songs returns 409 when appleMusicId is already registered", async () => {
    vi.mocked(fetchSong).mockResolvedValue({
      id: "am-duplicate-song",
      attributes: { name: "Duplicate Song", genreNames: [] },
    });

    vi.mocked(createDb).mockReturnValue({
      transaction: vi.fn().mockRejectedValue(
        createDrizzleConstraintError({
          constraintName: "songs_apple_music_id_key",
          query: 'insert into "songs"',
        }),
      ),
    } as never);

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: { appleMusicId: "am-duplicate-song" },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      message: "Apple Music ID is already registered for another song.",
    });
  });

  it("POST /api/songs returns 500 for unrelated DB errors", async () => {
    vi.mocked(fetchSong).mockResolvedValue({
      id: "am-broken-song",
      attributes: { name: "Broken Song", genreNames: [] },
    });

    vi.mocked(createDb).mockReturnValue({
      transaction: vi.fn().mockRejectedValue(new Error("DB error")),
    } as never);

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: { appleMusicId: "am-broken-song" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to create song." });
  });

  it("POST /api/songs returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song payload." });
  });

  it("POST /api/songs returns 400 when appleMusicId is empty", async () => {
    const res = await testRequest("/api/songs", {
      method: "POST",
      body: { appleMusicId: "" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song payload." });
  });

  it("POST /api/songs returns 502 when Apple Music API fails", async () => {
    vi.mocked(fetchSong).mockResolvedValue(
      new DbError({
        message: "Apple Music API から楽曲情報を取得できませんでした。",
        statusCode: 502,
      }),
    );

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: { appleMusicId: "am-not-found" },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      message: "Apple Music API から楽曲情報を取得できませんでした。",
    });
  });

  it("PATCH /api/songs/:id syncs song from Apple Music API", async () => {
    vi.mocked(fetchSong).mockResolvedValue({
      id: "am-existing-song",
      attributes: {
        name: "Updated Song",
        durationInMillis: 220000,
        isrc: "JPABC240009",
        genreNames: ["Rock"],
      },
      relationships: {
        artists: {
          data: [{ id: "am-artist-1", type: "artists", attributes: { name: "Artist One" } }],
        },
      },
    });

    const queryable = (resolvedValue: unknown) => {
      const obj: Record<string, unknown> = {
        where: vi.fn(() => obj),
        limit: vi.fn(() => obj),
        then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
      };
      return obj;
    };

    const selectFrom = vi
      .fn()
      // findSongById（syncSong冒頭）
      .mockReturnValueOnce(
        queryable([
          {
            id: "8f648f36-5be1-4af1-bf5d-cf8ebf222225",
            title: "Old Song",
            appleMusicId: "am-existing-song",
            length: 180,
            isrcs: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      )
      // findActiveArtistByAppleMusicId（resolveArtistIds）
      .mockReturnValueOnce(queryable([{ id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111" }]))
      // findOrCreateGenreIds（ジャンルID検索）
      .mockReturnValueOnce(queryable([{ id: "genre-id-1" }]));

    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: selectFrom,
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf222225",
                title: "Updated Song",
                appleMusicId: "am-existing-song",
                length: 220,
                isrcs: "JPABC240009",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
      insert: vi
        .fn()
        // songArtists INSERT (syncSongArtists)
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined),
        })
        // genres INSERT (findOrCreateGenreIds)
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })
        // songGenres INSERT (syncSongGenres)
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222225", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(200);
    expect(fetchSong).toHaveBeenCalledWith("am-existing-song");
  });

  it("PATCH /api/songs/:id returns 404 when song not found in DB", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222227", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Song not found." });
  });

  it("PATCH /api/songs/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/songs/not-uuid", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song id." });
  });
});
