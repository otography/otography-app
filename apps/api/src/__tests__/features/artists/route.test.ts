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
  fetchArtist: vi.fn(),
}));

import { createDb } from "../../../shared/db";
import { fetchArtist } from "../../../shared/apple-music";

const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    ...txMethods,
    transaction: vi.fn(async (fn) => fn(txMethods)),
  } as never);
};

describe("artists endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/artists returns artists list", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111",
                name: "Sample Artist",
                ipiCode: null,
                type: "person",
                gender: null,
                birthplace: null,
                birthdate: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      artists: [
        {
          id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111",
          name: "Sample Artist",
          ipiCode: null,
          type: "person",
          gender: null,
          birthplace: null,
          birthdate: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("GET /api/artists/:id returns artist", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211115",
                name: "Artist Detail",
                ipiCode: null,
                type: "person",
                gender: null,
                birthplace: null,
                birthdate: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211115");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211115",
        name: "Artist Detail",
        ipiCode: null,
        type: "person",
        gender: null,
        birthplace: null,
        birthdate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("GET /api/artists/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/artists/not-uuid");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist id." });
  });

  it("GET /api/artists/:id returns 404 when not found", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211116");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Artist not found." });
  });

  it("POST /api/artists creates artist from appleMusicId", async () => {
    vi.mocked(fetchArtist).mockResolvedValue({
      id: "am-new-artist-1",
      attributes: {
        name: "New Artist",
      },
    });

    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
              name: "New Artist",
              appleMusicId: "am-new-artist-1",
              ipiCode: null,
              type: null,
              gender: null,
              birthplace: null,
              birthdate: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        })),
      })),
    });

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: {
        appleMusicId: "am-new-artist-1",
      },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
        name: "New Artist",
        appleMusicId: "am-new-artist-1",
        ipiCode: null,
        type: null,
        gender: null,
        birthplace: null,
        birthdate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(fetchArtist).toHaveBeenCalledWith("am-new-artist-1");
  });

  it("POST /api/artists returns 409 when appleMusicId is already registered", async () => {
    vi.mocked(fetchArtist).mockResolvedValue({
      id: "am-duplicate-artist",
      attributes: { name: "Duplicate Artist" },
    });

    vi.mocked(createDb).mockReturnValue({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(
            createDrizzleConstraintError({
              constraintName: "artists_apple_music_id_key",
              query: 'insert into "artists"',
            }),
          ),
        })),
      })),
    } as never);

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-duplicate-artist" },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      message: "Apple Music ID is already registered for another artist.",
    });
  });

  it("POST /api/artists returns 500 for unrelated DB errors", async () => {
    vi.mocked(fetchArtist).mockResolvedValue({
      id: "am-broken-artist",
      attributes: { name: "Broken Artist" },
    });

    vi.mocked(createDb).mockReturnValue({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      })),
    } as never);

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-broken-artist" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to create artist." });
  });

  it("POST /api/artists returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
  });

  it("POST /api/artists returns 400 when appleMusicId is empty", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
  });

  it("POST /api/artists returns 502 when Apple Music API fails", async () => {
    vi.mocked(fetchArtist).mockResolvedValue(
      new DbError({
        message: "Apple Music API からアーティスト情報を取得できませんでした。",
        statusCode: 502,
      }),
    );

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-not-found" },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      message: "Apple Music API からアーティスト情報を取得できませんでした。",
    });
  });

  it("PATCH /api/artists/:id updates artist", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
                name: "Updated Artist",
                ipiCode: null,
                type: "person",
                gender: null,
                birthplace: "Tokyo",
                birthdate: "2000-01-01",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211113", {
      method: "PATCH",
      body: {
        name: "Updated Artist",
        birthplace: "Tokyo",
        birthdate: "2000-01-01",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
        name: "Updated Artist",
        ipiCode: null,
        type: "person",
        gender: null,
        birthplace: "Tokyo",
        birthdate: "2000-01-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("PATCH /api/artists/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/artists/not-uuid", {
      method: "PATCH",
      body: {
        name: "Updated Artist",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist id." });
  });

  it("PATCH /api/artists/:id returns 409 when appleMusicId is already registered", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(
              createDrizzleConstraintError({
                constraintName: "artists_apple_music_id_key",
                query: 'update "artists"',
              }),
            ),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211122", {
      method: "PATCH",
      body: {
        appleMusicId: "am-duplicate-artist",
      },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      message: "Apple Music ID is already registered for another artist.",
    });
  });

  it("PATCH /api/artists/:id returns 400 for empty payload", async () => {
    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211118", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide at least one field to update." });
  });

  it("PATCH /api/artists/:id returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211119", {
      method: "PATCH",
      body: {
        birthdate: "not-date",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
  });

  it("PATCH /api/artists/:id returns 404 when not found", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211120", {
      method: "PATCH",
      body: {
        name: "No Artist",
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Artist not found." });
  });

  it("PATCH /api/artists/:id allows clearing nullable fields with null", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211117",
                name: "Clearable Artist",
                ipiCode: null,
                type: null,
                gender: null,
                birthplace: null,
                birthdate: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-03T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211117", {
      method: "PATCH",
      body: {
        type: null,
        birthplace: null,
        birthdate: null,
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211117",
        name: "Clearable Artist",
        ipiCode: null,
        type: null,
        gender: null,
        birthplace: null,
        birthdate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("DELETE /api/artists/:id soft deletes artist", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211114",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211114", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("DELETE /api/artists/:id returns 404 when not found", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211121", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Artist not found." });
  });
});
