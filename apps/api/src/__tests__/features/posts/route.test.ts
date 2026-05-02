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
    getAuthSession: vi.fn(() => ({ sub: "firebase-user-1" })),
  };
});

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));

import { createDb } from "../../../shared/db";
import { getAuthSession } from "../../../shared/middleware";

const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  const methods = {
    execute: vi.fn().mockResolvedValue([]),
    ...txMethods,
  };

  vi.mocked(createDb).mockReturnValue({
    ...methods,
    transaction: vi.fn(async (fn) => fn(methods)),
  } as never);
};

describe("posts endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/posts returns posts list", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "6f648f36-5be1-4af1-bf5d-cf8ebf222221",
                userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222221",
                songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
                content: "Sample post",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/posts");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      posts: [
        {
          id: "6f648f36-5be1-4af1-bf5d-cf8ebf222221",
          userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222221",
          songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
          content: "Sample post",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("GET /api/posts/:id returns post", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "6f648f36-5be1-4af1-bf5d-cf8ebf222222",
                userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222222",
                songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
                content: "Detail post",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222222");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: {
        id: "6f648f36-5be1-4af1-bf5d-cf8ebf222222",
        userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222222",
        songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
        content: "Detail post",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("POST /api/posts creates post", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "8f648f36-5be1-4af1-bf5d-cf8ebf222223" }]),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "7f648f36-5be1-4af1-bf5d-cf8ebf222223" }]),
          })),
        })),
      });

    mockDbWithTransaction({
      select,
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "6f648f36-5be1-4af1-bf5d-cf8ebf222223",
              userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222223",
              songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
              content: "New post",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        })),
      })),
    });

    const res = await testRequest("/api/posts", {
      method: "POST",
      body: {
        songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
        content: "New post",
      },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      post: {
        id: "6f648f36-5be1-4af1-bf5d-cf8ebf222223",
        userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222223",
        songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
        content: "New post",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("PATCH /api/posts/:id updates post", async () => {
    const select = vi.fn().mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "7f648f36-5be1-4af1-bf5d-cf8ebf222224" }]),
        })),
      })),
    });

    mockDbWithTransaction({
      select,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "6f648f36-5be1-4af1-bf5d-cf8ebf222224",
                userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222224",
                songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222224",
                content: "Updated post",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222224", {
      method: "PATCH",
      body: {
        content: "Updated post",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      post: {
        id: "6f648f36-5be1-4af1-bf5d-cf8ebf222224",
        userId: "7f648f36-5be1-4af1-bf5d-cf8ebf222224",
        songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222224",
        content: "Updated post",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("DELETE /api/posts/:id returns 204", async () => {
    const select = vi.fn().mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "7f648f36-5be1-4af1-bf5d-cf8ebf222225" }]),
        })),
      })),
    });

    mockDbWithTransaction({
      select,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "6f648f36-5be1-4af1-bf5d-cf8ebf222225" }]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222225", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("PATCH /api/posts/:id returns 404 when RLS filters out the post", async () => {
    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));
    const select = vi.fn().mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "7f648f36-5be1-4af1-bf5d-cf8ebf222226" }]),
        })),
      })),
    });

    mockDbWithTransaction({ select, update });

    const res = await testRequest("/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222226", {
      method: "PATCH",
      body: {
        content: "Updated post",
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found or access denied." });
    expect(update).toHaveBeenCalled();
  });

  it("DELETE /api/posts/:id returns 404 when RLS filters out the post", async () => {
    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));
    const select = vi.fn().mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "7f648f36-5be1-4af1-bf5d-cf8ebf222228" }]),
        })),
      })),
    });

    mockDbWithTransaction({ select, update });

    const res = await testRequest("/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222228", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Post not found or access denied." });
    expect(update).toHaveBeenCalled();
  });

  it("returns 400 for invalid post id", async () => {
    const res = await testRequest("/api/posts/not-uuid");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid post id." });
  });

  it("returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/posts", {
      method: "POST",
      body: {
        songId: "bad",
        content: "",
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Please provide a valid post payload." });
  });

  it("POST /api/posts returns 401 when session is missing", async () => {
    vi.mocked(getAuthSession).mockReturnValueOnce(null);

    const res = await testRequest("/api/posts", {
      method: "POST",
      body: {
        songId: "8f648f36-5be1-4af1-bf5d-cf8ebf222223",
        content: "New post",
      },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "You are not logged in." });
  });
});
