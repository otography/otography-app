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

  it("POST /api/artists creates artist", async () => {
    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
              name: "New Artist",
              ipiCode: null,
              type: "group",
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
        name: "New Artist",
        type: "group",
      },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
        name: "New Artist",
        ipiCode: null,
        type: "group",
        gender: null,
        birthplace: null,
        birthdate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("POST /api/artists returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: {
        name: "",
        type: "band",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
  });

  it("POST /api/artists returns 400 for invalid birthplace", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: {
        name: "Bad Birthplace Artist",
        birthplace: "New York",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
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
});
