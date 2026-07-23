import { describe, expect, it, vi } from "vitest";
import { mockResolveSession } from "../../setup";

// 新しいオペークセッションミドルウェアのテスト
// resolveSession モックを通じて認証フローを検証する

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

import { Hono } from "hono";
import type { Env } from "../../../shared/types/env";
import {
  authSessionMiddleware,
  requireAuthMiddleware,
  requireFreshSessionMiddleware,
} from "../../../shared/middleware/auth.middleware";

// テスト用アプリ: authSessionMiddleware → requireAuthMiddleware → handler
// dbMiddlewareの代わりにモックDBを提供する
const createTestApp = () => {
  const app = new Hono<Env>()
    .use("*", async (c, next) => {
      c.set("db", () => ({}) as never);
      await next();
    })
    .use("/protected/*", authSessionMiddleware())
    .use("/protected/*", requireAuthMiddleware())
    .get("/protected/data", (c) => c.json({ authenticated: true, sub: c.get("authSession")?.sub }))
    .use("/sensitive/*", authSessionMiddleware())
    .use("/sensitive/*", requireAuthMiddleware())
    .use("/sensitive/*", requireFreshSessionMiddleware())
    .delete("/sensitive/delete", (c) => c.json({ deleted: true }));
  return app;
};

describe("authSessionMiddleware + requireAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す（オペークCookieなし）", async () => {
    const app = createTestApp();
    const res = await app.request("/protected/data");
    expect(res.status).toBe(401);
  });

  it("有効なセッションで200を返す", async () => {
    mockResolveSession.mockResolvedValue({
      claims: { sub: "user123", email: "test@example.com" },
      session: { id: "sess", userId: "uuid", version: 1 },
    });
    const app = createTestApp();
    const res = await app.request("/protected/data", {
      headers: { Cookie: `otography_session=${"a".repeat(43)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ authenticated: true, sub: "user123" });
  });

  it("セッション解決がnullならCookieをクリアして401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const app = createTestApp();
    const res = await app.request("/protected/data", {
      headers: { Cookie: "otography_session=invalid-id" },
    });
    expect(res.status).toBe(401);
  });

  it("セッションストア障害なら500を返しCookieを消さない", async () => {
    mockResolveSession.mockResolvedValue(new Error("database unavailable"));
    const app = createTestApp();
    const res = await app.request("/protected/data", {
      headers: { Cookie: `otography_session=${"a".repeat(43)}` },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("requireFreshSessionMiddleware", () => {
  it("strictモードでセッションを再解決する", async () => {
    // resolveSession が2回呼ばれる（通常 + strict）
    mockResolveSession
      .mockResolvedValueOnce({
        claims: { sub: "user123" },
        session: { id: "sess", userId: "uuid", version: 1 },
      })
      .mockResolvedValueOnce({
        claims: { sub: "user123" },
        session: { id: "sess", userId: "uuid", version: 1 },
      });
    const app = createTestApp();
    const res = await app.request("/sensitive/delete", {
      method: "DELETE",
      headers: { Cookie: `otography_session=${"a".repeat(43)}` },
    });
    expect(res.status).toBe(200);
  });

  it("strictモードでエラーなら401を返す", async () => {
    const { AuthError } = await import("@repo/errors/server");
    mockResolveSession
      .mockResolvedValueOnce({
        claims: { sub: "user123" },
        session: { id: "sess", userId: "uuid", version: 1 },
      })
      .mockResolvedValueOnce(
        new AuthError({
          message: "Session revoked.",
          code: "auth/session-cookie-revoked",
          statusCode: 401,
          clearCookie: true,
        }),
      );
    const app = createTestApp();
    const res = await app.request("/sensitive/delete", {
      method: "DELETE",
      headers: { Cookie: `otography_session=${"a".repeat(43)}` },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("otography_session=");
  });

  it("strictモードの一時障害なら500を返しCookieを消さない", async () => {
    mockResolveSession
      .mockResolvedValueOnce({
        claims: { sub: "user123" },
        session: { id: "sess", userId: "uuid", version: 1 },
      })
      .mockResolvedValueOnce(new Error("database unavailable"));
    const app = createTestApp();

    const res = await app.request("/sensitive/delete", {
      method: "DELETE",
      headers: { Cookie: `otography_session=${"a".repeat(43)}` },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
