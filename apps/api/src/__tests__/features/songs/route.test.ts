import { describe, expect, it, vi } from "vitest";
import { testRequest } from "../../helpers/test-client";

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

import { createDb } from "../../../shared/db";

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

  it("POST /api/songs creates song", async () => {
    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
              title: "New Song",
              length: 240,
              isrcs: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        })),
      })),
    });

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {
        title: "New Song",
        length: 240,
      },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      song: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
        title: "New Song",
        length: 240,
        isrcs: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("POST /api/songs returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {
        title: "",
        length: -1,
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song payload." });
  });

  it("POST /api/songs returns 400 when isrcs is empty after trim", async () => {
    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {
        title: "Song with empty isrcs",
        isrcs: "   ",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song payload." });
  });

  it("POST /api/songs returns 404 when artist does not exist", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs", {
      method: "POST",
      body: {
        title: "Song with unknown artist",
        artistId: "8f648f36-5be1-4af1-bf5d-cf8ebf222299",
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Artist not found." });
  });

  it("PATCH /api/songs/:id updates song", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf222225",
                title: "Updated Song",
                length: 220,
                isrcs: "JPABC240009",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222225", {
      method: "PATCH",
      body: {
        title: "Updated Song",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      song: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf222225",
        title: "Updated Song",
        length: 220,
        isrcs: "JPABC240009",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("PATCH /api/songs/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/songs/not-uuid", {
      method: "PATCH",
      body: {
        title: "Updated Song",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid song id." });
  });

  it("PATCH /api/songs/:id returns 400 for empty payload", async () => {
    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222226", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide at least one field to update." });
  });

  it("PATCH /api/songs/:id returns 404 when song not found", async () => {
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222227", {
      method: "PATCH",
      body: {
        title: "No Song",
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Song not found." });
  });

  it("PATCH /api/songs/:id returns 404 when artist does not exist", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/songs/8f648f36-5be1-4af1-bf5d-cf8ebf222228", {
      method: "PATCH",
      body: {
        artistId: "8f648f36-5be1-4af1-bf5d-cf8ebf222299",
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Artist not found." });
  });
});
