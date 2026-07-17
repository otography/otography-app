import { type Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { testRequest } from "../../helpers/test-client";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

/*
 * テストリスト: artists ルート（カタログ書き込みの同期専用化）
 *
 * GET:
 * 1. GET /api/artists → 200 (一覧 + ページネーション)
 * 2. GET /api/artists/:id → 200 (詳細)
 * 3. GET /api/artists/:id → 400 (不正な id) → bad-request
 * 4. GET /api/artists/:id → 404 (not found) → artist-not-found
 *
 * POST（appleMusicId のみ受け取り Apple Music から作成）:
 * 5. POST /api/artists → 201 (作成)
 * 6. POST /api/artists → 409 (appleMusicId 重複、RlsError ラップ経由) → artist-already-exists
 * 7. POST /api/artists → 500 (その他 DB エラー、RlsError ラップ経由) → internal-error
 * 8. POST /api/artists → 400 (不正な payload / 空の appleMusicId) → bad-request
 * 9. POST /api/artists → 502 (Apple Music API エラー) → bad-gateway
 *
 * PATCH（Apple Music 再同期。ボディ不要）:
 * 10. PATCH /api/artists/:id → 200 (既存行の appleMusicId で fetchArtist が呼ばれる)
 * 11. PATCH /api/artists/:id → 404 (not found) → artist-not-found
 * 12. PATCH /api/artists/:id → 400 (不正な id) → bad-request
 * 13. PATCH /api/artists/:id → 502 (Apple Music API エラー) → bad-gateway
 *
 * DELETE（エンドポイント廃止）:
 * 14. DELETE /api/artists/:id → 404 (ルートが存在しない)
 */

vi.mock("../../../shared/middleware", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/middleware")>(
    "../../../shared/middleware",
  );

  // モック内で共有する getAuthSession モック
  // rateLimitByUser モックがセッション状態を参照できるように、
  // vi.fn() のクロージャでミュータブルなオブジェクトとして定義
  const mockGetAuthSession = vi.fn((_c: unknown) => ({ sub: "firebase-user-1" }));

  return {
    ...actual,
    csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    requireAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => await next(),
    // rateLimitByUser をモック: セッションがあれば next()、なければ 401
    rateLimitByUser: () => async (c: Context, next: () => Promise<void>) => {
      const session = mockGetAuthSession(c);
      if (!session) {
        return c.json({ message: "You are not logged in." }, 401);
      }
      await next();
    },
    getAuthSession: mockGetAuthSession,
  };
});

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

vi.mock("../../../shared/apple-music", () => ({
  fetchArtist: vi.fn(),
}));

import { createDbClient } from "../../../shared/db";
import { fetchArtist } from "../../../shared/apple-music";

// RLS ヘルパーが tx.execute("set local role ...") を呼ぶため execute スタブが必要
const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    ...txMethods,
  };
  vi.mocked(createDbClient).mockReturnValue({
    db: {
      ...tx,
      transaction: vi.fn(async (fn) => fn(tx)),
    },
    end: async () => undefined,
  } as never);
};

describe("artists endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/artists returns artists list with pagination", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              $dynamic: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
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
        })),
      })),
    });

    const res = await testRequest("/api/artists");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
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
      pagination: {
        hasNext: false,
        nextCursor: null,
      },
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
    expect(await res.json()).toMatchObject({
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
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Please provide a valid artist id.",
    });
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
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/artist-not-found",
      title: "Artist Not Found",
      status: 404,
      detail: "Artist not found.",
    });
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
    expect(await res.json()).toMatchObject({
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

    // withAuthenticatedRole がトランザクション内のエラーを RlsError にラップするため、
    // unique violation は cause チェーン経由で検出される（normalizeArtistDbError）
    mockDbWithTransaction({
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
    });

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-duplicate-artist" },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/artist-already-exists",
      title: "Artist Already Exists",
      status: 409,
      detail: "Apple Music ID is already registered for another artist.",
    });
  });

  it("POST /api/artists returns 500 for unrelated DB errors", async () => {
    vi.mocked(fetchArtist).mockResolvedValue({
      id: "am-broken-artist",
      attributes: { name: "Broken Artist" },
    });

    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      })),
    });

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-broken-artist" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/internal-error",
      title: "Internal Server Error",
      status: 500,
      detail: "Failed to create artist.",
    });
  });

  it("POST /api/artists returns 400 for invalid payload", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Please provide a valid artist payload.",
    });
  });

  it("POST /api/artists returns 400 when appleMusicId is empty", async () => {
    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Please provide a valid artist payload.",
    });
  });

  it("POST /api/artists returns 502 when Apple Music API fails", async () => {
    vi.mocked(fetchArtist).mockResolvedValue(
      new DbError({
        message: "Apple Music API からアーティスト情報を取得できませんでした。",
        statusCode: 502,
      }),
    );
    vi.mocked(createDbClient).mockReturnValue({
      db: {},
      end: async () => undefined,
    } as never);

    const res = await testRequest("/api/artists", {
      method: "POST",
      body: { appleMusicId: "am-not-found" },
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-gateway",
      title: "Bad Gateway",
      status: 502,
      detail: "Apple Music API からアーティスト情報を取得できませんでした。",
    });
  });

  it("PATCH /api/artists/:id syncs artist from Apple Music API", async () => {
    vi.mocked(fetchArtist).mockResolvedValue({
      id: "am-existing-artist",
      attributes: {
        name: "Synced Artist",
      },
    });

    mockDbWithTransaction({
      // findArtistById（syncArtist 冒頭、anon ロール）
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
                name: "Old Artist",
                appleMusicId: "am-existing-artist",
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
      // updateArtistById（authenticated ロール）
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
                name: "Synced Artist",
                appleMusicId: "am-existing-artist",
                ipiCode: null,
                type: "person",
                gender: null,
                birthplace: null,
                birthdate: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ]),
          })),
        })),
      })),
    });

    // ボディ不要（既存行の appleMusicId で再同期）
    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211113", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      artist: {
        id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
        name: "Synced Artist",
        appleMusicId: "am-existing-artist",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
    // クライアント入力ではなく既存行の appleMusicId で呼ばれる
    expect(fetchArtist).toHaveBeenCalledWith("am-existing-artist");
  });

  it("PATCH /api/artists/:id returns 404 when artist not found in DB", async () => {
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211120", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/artist-not-found",
      title: "Artist Not Found",
      status: 404,
      detail: "Artist not found.",
    });
    expect(fetchArtist).not.toHaveBeenCalled();
  });

  it("PATCH /api/artists/:id returns 400 for invalid id", async () => {
    const res = await testRequest("/api/artists/not-uuid", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Please provide a valid artist id.",
    });
  });

  it("PATCH /api/artists/:id returns 502 when Apple Music API fails", async () => {
    vi.mocked(fetchArtist).mockResolvedValue(
      new DbError({
        message: "Apple Music API からアーティスト情報を取得できませんでした。",
        statusCode: 502,
      }),
    );

    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "8f648f36-5be1-4af1-bf5d-cf8ebf211114",
                name: "Unreachable Artist",
                appleMusicId: "am-unreachable",
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
      })),
    });

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211114", {
      method: "PATCH",
      body: {},
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/bad-gateway",
      title: "Bad Gateway",
      status: 502,
      detail: "Apple Music API からアーティスト情報を取得できませんでした。",
    });
  });

  it("DELETE /api/artists/:id returns 404 (endpoint removed)", async () => {
    vi.mocked(createDbClient).mockReturnValue({
      db: {},
      end: async () => undefined,
    } as never);

    const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211121", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});
