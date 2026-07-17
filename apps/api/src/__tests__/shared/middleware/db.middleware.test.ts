/**
 * テストリスト: DB ミドルウェアの接続ライフサイクル（MUS-25）
 *
 * - DB 使用リクエストの応答後に end() を waitUntil 経由で呼ぶ
 * - DB 未使用リクエストでは接続を作らない
 * - end() が失敗してもレスポンスに影響しない
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../shared/types/env";

const { mockDb, mockEnd, mockCreateDbClient } = vi.hoisted(() => {
  const db = { query: "db" };
  const end = vi.fn();
  return {
    mockDb: db,
    mockEnd: end,
    mockCreateDbClient: vi.fn(() => ({
      db,
      end,
    })),
  };
});

vi.mock("../../../shared/db", () => ({
  createDbClient: mockCreateDbClient,
}));

import { dbMiddleware } from "../../../shared/middleware/db.middleware";

const requestWithWaitUntil = async (app: Hono<Env>) => {
  const waitUntil = vi.fn();
  const res = await app.request("http://localhost/test", {}, {}, {
    waitUntil,
    passThroughOnException: vi.fn(),
    props: {},
  } satisfies ExecutionContext);

  return { res, waitUntil };
};

describe("DB ミドルウェアの接続ライフサイクル（MUS-25）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
  });

  it("DB 使用リクエストの応答後に end() を waitUntil 経由で呼ぶ", async () => {
    const app = new Hono<Env>();
    app.use(dbMiddleware());
    app.get("/test", (c) => {
      expect(c.var.db()).toBe(mockDb);
      return c.json({ ok: true });
    });

    const { res, waitUntil } = await requestWithWaitUntil(app);

    expect(res.status).toBe(200);
    expect(mockCreateDbClient).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("同一リクエストで DB getter を複数回呼んでも一度だけ close する", async () => {
    const app = new Hono<Env>();
    app.use(dbMiddleware());
    app.get("/test", (c) => {
      c.var.db();
      c.var.db();
      return c.json({ ok: true });
    });

    await requestWithWaitUntil(app);

    expect(mockCreateDbClient).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it("DB 未使用リクエストでは接続を作らない", async () => {
    const app = new Hono<Env>();
    app.use(dbMiddleware());
    app.get("/test", (c) => c.json({ ok: true }));

    const { res, waitUntil } = await requestWithWaitUntil(app);

    expect(res.status).toBe(200);
    expect(mockCreateDbClient).not.toHaveBeenCalled();
    expect(mockEnd).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("downstream が例外で終了しても生成済み接続を close する", async () => {
    const app = new Hono<Env>();
    const waitUntil = vi.fn();
    app.use(dbMiddleware());
    app.get("/test", (c) => {
      c.var.db();
      throw "route failed";
    });

    await expect(
      app.request("http://localhost/test", {}, {}, {
        waitUntil,
        passThroughOnException: vi.fn(),
        props: {},
      } satisfies ExecutionContext),
    ).rejects.toBe("route failed");

    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("end() の失敗を記録し、waitUntil の失敗としては伝播しない", async () => {
    const app = new Hono<Env>();
    const endError = new Error("close failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockEnd.mockRejectedValue(endError);
    app.use(dbMiddleware());
    app.get("/test", (c) => {
      c.var.db();
      return c.json({ ok: true });
    });

    const { res, waitUntil } = await requestWithWaitUntil(app);

    expect(res.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Failed to close database connection.", endError);
  });
});
