import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// getConnInfo をモックしてテスト用IPアドレスを制御可能にする
// vi.mock のクロージャで変数再代入を反映するため、ミュータブルなオブジェクトを使用
const mockConnInfo = { remote: { address: "192.168.1.1" } };

vi.mock("hono/cloudflare-workers", async () => {
  const actual = await vi.importActual("hono/cloudflare-workers");
  return {
    ...actual,
    getConnInfo: () => mockConnInfo,
  };
});

// getAuthSession をモックしてテスト用セッションを制御可能にする
const mockAuthSession = { value: null as { sub: string } | null };

vi.mock("../../../shared/auth/auth-session", () => ({
  getAuthSession: () => mockAuthSession.value,
}));

// モック適用後にテスト対象をインポート
import { rateLimitByIp, rateLimitByUser } from "../../../shared/middleware/rate-limit.middleware";

/**
 * テスト用のモックenvを作成
 * limitFn: { key: string } を受け取り { success: boolean } を返すモック関数
 */
const createMockEnv = (limitFn: (opts: { key: string }) => Promise<{ success: boolean }>) => ({
  ...env,
  TEST_LIMITER: { limit: limitFn },
});

describe("rateLimitByIp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnInfo.remote.address = "192.168.1.1";
  });

  it("IPアドレスをキーにしてlimit()を呼び出す", async () => {
    const limitSpy = vi.fn(async () => ({ success: true }));
    const mockEnv = createMockEnv(limitSpy);
    const app = new Hono();
    app.use(rateLimitByIp("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("http://localhost/test", {}, mockEnv);

    expect(limitSpy).toHaveBeenCalledWith({ key: "192.168.1.1" });
  });

  it("success=trueの場合、next()を呼び出してリクエストを通す", async () => {
    const mockEnv = createMockEnv(async () => ({ success: true }));
    const app = new Hono();
    app.use(rateLimitByIp("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {}, mockEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("bindingが未設定の場合は設定名を含むエラーにする", async () => {
    const app = new Hono();
    app.onError((error, c) => c.text(error.message, 500));
    app.use(rateLimitByIp("MISSING_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/test", {}, env);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Rate limiter binding MISSING_LIMITER is not configured.");
  });

  it("success=falseの場合、429を返す (VAL-MW-003)", async () => {
    const mockEnv = createMockEnv(async () => ({ success: false }));
    const app = new Hono();
    app.use(rateLimitByIp("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {}, mockEnv);

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/rate-limit-exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("異なるIPアドレスは独立したカウンターを持つ (VAL-MW-004)", async () => {
    const callCounts = new Map<string, number>();
    const limitFn = vi.fn(async (opts: { key: string }) => {
      const key = opts.key;
      const count = (callCounts.get(key) ?? 0) + 1;
      callCounts.set(key, count);
      return { success: count <= 2 };
    });
    const mockEnv = createMockEnv(limitFn);
    const app = new Hono();
    app.use(rateLimitByIp("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    // IP A: 2回成功
    mockConnInfo.remote.address = "10.0.0.1";
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);

    // IP A: 3回目で429
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(429);

    // IP B: まだ成功する（独立したカウンター）
    mockConnInfo.remote.address = "10.0.0.2";
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);
  });

  it("レートリミット時、ハンドラーは実行されない (VAL-CROSS-002)", async () => {
    const handlerSpy = vi.fn((c) => c.json({ ok: true }));
    const limitFn = vi.fn(async () => ({ success: false }));
    const mockEnv = createMockEnv(limitFn);
    const app = new Hono();
    app.use(rateLimitByIp("TEST_LIMITER"));
    app.get("/test", handlerSpy);

    await app.request("http://localhost/test", {}, mockEnv);

    expect(handlerSpy).not.toHaveBeenCalled();
  });
});

describe("rateLimitByUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession.value = { sub: "user-123" };
  });

  it("session.subをキーにしてlimit()を呼び出す", async () => {
    const limitSpy = vi.fn(async () => ({ success: true }));
    const mockEnv = createMockEnv(limitSpy);
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("http://localhost/test", {}, mockEnv);

    expect(limitSpy).toHaveBeenCalledWith({ key: "user-123" });
  });

  it("セッションがない場合、401を返す", async () => {
    mockAuthSession.value = null;
    const limitSpy = vi.fn(async () => ({ success: true }));
    const mockEnv = createMockEnv(limitSpy);
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {}, mockEnv);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "You are not logged in.",
    });
    // セッションがない場合、limit()は呼び出されない
    expect(limitSpy).not.toHaveBeenCalled();
  });

  it("success=trueの場合、next()を呼び出してリクエストを通す", async () => {
    const mockEnv = createMockEnv(async () => ({ success: true }));
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {}, mockEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("success=falseの場合、429を返す (VAL-MW-003)", async () => {
    const mockEnv = createMockEnv(async () => ({ success: false }));
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {}, mockEnv);

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/rate-limit-exceeded",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("異なるユーザーIDは独立したカウンターを持つ (VAL-MW-004)", async () => {
    const callCounts = new Map<string, number>();
    const limitFn = vi.fn(async (opts: { key: string }) => {
      const key = opts.key;
      const count = (callCounts.get(key) ?? 0) + 1;
      callCounts.set(key, count);
      return { success: count <= 2 };
    });
    const mockEnv = createMockEnv(limitFn);
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", (c) => c.json({ ok: true }));

    // User A: 2回成功
    mockAuthSession.value = { sub: "user-a" };
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);

    // User A: 3回目で429
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(429);

    // User B: まだ成功する（独立したカウンター）
    mockAuthSession.value = { sub: "user-b" };
    expect((await app.request("http://localhost/test", {}, mockEnv)).status).toBe(200);
  });

  it("レートリミット時、ハンドラーは実行されない (VAL-CROSS-002)", async () => {
    const handlerSpy = vi.fn((c) => c.json({ ok: true }));
    const limitFn = vi.fn(async () => ({ success: false }));
    const mockEnv = createMockEnv(limitFn);
    const app = new Hono();
    app.use(rateLimitByUser("TEST_LIMITER"));
    app.get("/test", handlerSpy);

    await app.request("http://localhost/test", {}, mockEnv);

    expect(handlerSpy).not.toHaveBeenCalled();
  });
});
