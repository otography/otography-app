import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../..";
import { testRequest } from "../../helpers/test-client";

// DBモック — readinessテストでcreateDbClientの戻り値を制御
const mockExecute = vi.fn();
vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: { execute: mockExecute }, end: async () => undefined })),
}));

// firebase-restモック — モジュール読み込み時の副作用回避
vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

describe("GET /api/health (liveness)", () => {
  it("200と{ status: 'ok' }を返す (VAL-LIVE-001)", async () => {
    const res = await testRequest("/api/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("cookieなしでも200を返す（認証不要） (VAL-LIVE-002)", async () => {
    // cookieヘッダーを一切送らずにリクエスト
    const res = await testRequest("/api/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("Cache-Control: no-store ヘッダーが含まれる (VAL-LIVE-003)", async () => {
    const res = await testRequest("/api/health");

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBe("no-store");
  });
});

describe("GET / (旧ルートの削除確認)", () => {
  it("'Hello Hono!' を返さない（404になる） (VAL-CROSS-001)", async () => {
    const res = await testRequest("/");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/health/ready (readiness)", () => {
  const mockFetch = vi.fn();

  // レスポンスボディの型定義
  interface CheckResult {
    status: string;
    latencyMs: number;
    error?: string;
  }
  interface ReadyResponse {
    status: string;
    timestamp: string;
    checks: {
      database: CheckResult;
      firebase: CheckResult;
      appleMusic: CheckResult;
    };
  }

  const parseReadyBody = (body: Record<string, unknown>): ReadyResponse =>
    body as unknown as ReadyResponse;

  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: 全dep正常
    mockExecute.mockResolvedValue([{ result: 1 }]);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("全dep正常時: 200とokを返す (VAL-READY-001)", async () => {
    const res = await testRequest("/api/health/ready");

    expect(res.status).toBe(200);
    const body = parseReadyBody(await res.json());
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.firebase.status).toBe("ok");
    expect(body.checks.appleMusic.status).toBe("ok");
  });

  it("DB down時: 503とunhealthyを返す (VAL-READY-002)", async () => {
    mockExecute.mockRejectedValue(new Error("Connection refused"));

    const res = await testRequest("/api/health/ready");

    expect(res.status).toBe(503);
    const body = parseReadyBody(await res.json());
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("unhealthy");
    // クリティカルでない依存関係は影響を受けない
    expect(body.checks.firebase.status).toBe("ok");
  });

  it("Firebase config missing時: 503とunhealthyを返す (VAL-READY-003)", async () => {
    // Firebase設定を欠落させたenvを直接渡す
    const envWithoutFirebase = {
      ...env,
      FIREBASE_PROJECT_ID: undefined as unknown as string,
      FIREBASE_CLIENT_EMAIL: undefined as unknown as string,
      FIREBASE_PRIVATE_KEY: undefined as unknown as string,
    };
    const res = await app.request(
      new URL("/api/health/ready", "http://localhost:3001"),
      {},
      envWithoutFirebase,
      {
        waitUntil: () => undefined,
        passThroughOnException: () => undefined,
        props: {},
      },
    );

    expect(res.status).toBe(503);
    const body = parseReadyBody(await (res.json() as Promise<Record<string, unknown>>));
    expect(body.status).toBe("unhealthy");
    expect(body.checks.firebase.status).toBe("unhealthy");
    // DBは正常なのでok
    expect(body.checks.database.status).toBe("ok");
  });

  it("Apple Music down時: degradedだが200（503にしない）(VAL-READY-004)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const res = await testRequest("/api/health/ready");

    // Apple Musicはnon-criticalなので全体は200
    expect(res.status).toBe(200);
    const body = parseReadyBody(await res.json());
    expect(body.checks.appleMusic.status).toBe("degraded");
    // クリティカルな依存関係は正常
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.firebase.status).toBe("ok");
  });

  it("各checkにlatencyMsが含まれる（数値、0以上）(VAL-READY-005)", async () => {
    const res = await testRequest("/api/health/ready");
    const body = parseReadyBody(await res.json());

    expect(res.status).toBe(200);
    for (const [, check] of Object.entries(body.checks)) {
      expect(check.latencyMs).toBeTypeOf("number");
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("cookieなしで200または503（401/403を返さない）(VAL-READY-006)", async () => {
    // cookieなしでリクエスト — 認証なしでアクセス可能
    const res = await testRequest("/api/health/ready");

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect([200, 503]).toContain(res.status);
    const body = parseReadyBody(await res.json());
    expect(body.checks).toBeDefined();
  });

  it("timestampフィールドにISO 8601形式の日時が含まれる (VAL-READY-007)", async () => {
    const res = await testRequest("/api/health/ready");
    const body = parseReadyBody(await res.json());

    expect(body.timestamp).toBeDefined();
    // ISO 8601としてパース可能であること
    const parsed = new Date(body.timestamp);
    expect(parsed.toString()).not.toBe("Invalid Date");
    // ISO文字列形式であること
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
