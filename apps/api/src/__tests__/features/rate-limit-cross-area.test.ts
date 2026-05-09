import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie, mockCreateSessionCookie } from "../setup";

// getConnInfo をモックしてテスト用IPアドレスを制御可能にする
const mockConnInfo = { remote: { address: "192.168.1.1" } };

vi.mock("hono/cloudflare-workers", async () => {
  const actual = await vi.importActual("hono/cloudflare-workers");
  return {
    ...actual,
    getConnInfo: () => mockConnInfo,
  };
});

// 各ユースケース層をモック - レートリミットテストではDB操作は不要
vi.mock("../../features/posts/usecase", () => ({
  registerPost: vi.fn(async () => ({
    post: {
      id: "post-uuid-1",
      userId: "user-uuid-1",
      songId: "song-uuid-1",
      content: "Test post",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })),
  getPosts: vi.fn(),
  getPost: vi.fn(),
  modifyPost: vi.fn(),
  removePost: vi.fn(),
}));

vi.mock("../../features/post-likes/usecase", () => ({
  toggleLike: vi.fn(async () => ({ liked: true, likeCount: 1 })),
}));

vi.mock("../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  createDb: vi.fn(),
}));

vi.mock("../../shared/apple-music", () => ({
  fetchArtist: vi.fn(),
  fetchSong: vi.fn(),
}));

// モック適用後にテスト対象をインポート
import { signInWithPassword } from "../../shared/firebase/firebase-rest";
import { createDb } from "../../shared/db";
import { app } from "../../index";

// ===========================================================================
// VAL-CROSS-001: 全エンドポイントの429レスポンスが一貫したエラー形式を持つ
// ===========================================================================

/** レートリミットモック関数の型 */
type MockLimitFn = (opts: { key: string }) => Promise<{ success: boolean }>;

/**
 * 指定閾値で即座にレートリミット超過を発生させるモックenvを作成
 * maxCalls回まではsuccess=true、以降はfalse
 */
const createCountingMockEnv = (
  bindingName: string,
  maxCalls: number,
): typeof env & Record<string, { limit: ReturnType<typeof vi.fn<MockLimitFn>> }> => {
  let callCount = 0;
  return {
    ...env,
    [bindingName]: {
      limit: vi.fn<MockLimitFn>(async () => {
        callCount++;
        return { success: callCount <= maxCalls };
      }),
    },
  } as typeof env & Record<string, { limit: ReturnType<typeof vi.fn<MockLimitFn>> }>;
};

/**
 * DB モック: ユーザーレコード作成成功をシミュレート
 */
const mockDbWithUserInsert = (rows: unknown[] = [{ id: "uuid-user" }]) => {
  vi.mocked(createDb).mockReturnValue({
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn(async (fn) =>
      fn({
        execute: vi.fn(() => Promise.resolve([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue(rows),
            })),
          })),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(rows),
            })),
          })),
        })),
      }),
    ),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(rows),
        })),
      })),
    })),
  } as never);
};

describe("VAL-CROSS-001: 全エンドポイントの429レスポンスが一貫したエラー形式を持つ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sign-in, コンテンツ作成, いいね の429レスポンスが同じ body shape を持つ", async () => {
    // --- sign-in の429を取得 ---
    vi.mocked(signInWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockDbWithUserInsert();

    const signinEnv = createCountingMockEnv("AUTH_SIGNIN_RATE_LIMITER", 5);
    const SIGN_IN_URL = new URL("/api/auth/sign-in", "http://localhost:3001");

    // 5リクエスト成功
    for (let i = 0; i < 5; i++) {
      await app.request(
        SIGN_IN_URL,
        {
          method: "POST",
          headers: [["Content-Type", "application/json"]],
          body: JSON.stringify({ email: "test@example.com", password: "password123" }),
        },
        signinEnv,
      );
    }

    // 6リクエスト目 → 429
    const signinRes = await app.request(
      SIGN_IN_URL,
      {
        method: "POST",
        headers: [["Content-Type", "application/json"]],
        body: JSON.stringify({ email: "test@example.com", password: "password123" }),
      },
      signinEnv,
    );
    expect(signinRes.status).toBe(429);
    const signinBody = await signinRes.json();

    // --- コンテンツ作成 (POST /api/posts) の429を取得 ---
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });

    const contentEnv = createCountingMockEnv("CONTENT_RATE_LIMITER", 30);
    const POSTS_URL = new URL("/api/posts", "http://localhost:3001");

    // 30リクエスト成功
    for (let i = 0; i < 30; i++) {
      await app.request(
        POSTS_URL,
        {
          method: "POST",
          headers: [
            ["Content-Type", "application/json"],
            ["Cookie", "otography_session=valid-session-cookie"],
          ],
          body: JSON.stringify({ appleMusicId: "am-song-001", content: "Test post" }),
        },
        contentEnv,
      );
    }

    // 31リクエスト目 → 429
    const contentRes = await app.request(
      POSTS_URL,
      {
        method: "POST",
        headers: [
          ["Content-Type", "application/json"],
          ["Cookie", "otography_session=valid-session-cookie"],
        ],
        body: JSON.stringify({ appleMusicId: "am-song-001", content: "Test post" }),
      },
      contentEnv,
    );
    expect(contentRes.status).toBe(429);
    const contentBody = await contentRes.json();

    // --- いいね (POST /api/posts/:id/like) の429を取得 ---
    const likeEnv = createCountingMockEnv("LIKE_RATE_LIMITER", 30);
    const LIKE_URL = new URL(
      "/api/posts/6f648f36-5be1-4af1-bf5d-cf8ebf222221/like",
      "http://localhost:3001",
    );

    // 30リクエスト成功
    for (let i = 0; i < 30; i++) {
      await app.request(
        LIKE_URL,
        {
          method: "POST",
          headers: [["Cookie", "otography_session=valid-session-cookie"]],
        },
        likeEnv,
      );
    }

    // 31リクエスト目 → 429
    const likeRes = await app.request(
      LIKE_URL,
      {
        method: "POST",
        headers: [["Cookie", "otography_session=valid-session-cookie"]],
      },
      likeEnv,
    );
    expect(likeRes.status).toBe(429);
    const likeBody = await likeRes.json();

    // --- 全ての429レスポンスが同じ body shape を持つことを検証 ---
    const expectedShape = {
      type: "https://api.otography.com/errors/too-many-requests",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests. Please try again later.",
    };

    expect(signinBody).toMatchObject(expectedShape);
    expect(contentBody).toMatchObject(expectedShape);
    expect(likeBody).toMatchObject(expectedShape);
  });
});

// ===========================================================================
// VAL-CROSS-003: 認証エンドポイントは認証済みユーザーでもIPベースでレートリミット
// ===========================================================================

describe("VAL-CROSS-003: 認証エンドポイントはIPベースのレートリミットを使用する", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // IPアドレスを初期化
    mockConnInfo.remote.address = "10.0.0.1";
  });

  it("同じユーザーが異なるIPからリクエストすると、IPごとに独立したカウンターを持つ", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockDbWithUserInsert();

    // IPごとに独立したカウンターを持つモックenvを作成
    const counters = new Map<string, number>();
    const RATE_LIMIT = 5;
    const signinEnv = {
      ...env,
      AUTH_SIGNIN_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async (opts) => {
          const count = (counters.get(opts.key) ?? 0) + 1;
          counters.set(opts.key, count);
          return { success: count <= RATE_LIMIT };
        }),
      },
    };

    const SIGN_IN_URL = new URL("/api/auth/sign-in", "http://localhost:3001");
    const signInBody = JSON.stringify({ email: "test@example.com", password: "password123" });

    // IP A (10.0.0.1) から5リクエスト → 全て成功
    mockConnInfo.remote.address = "10.0.0.1";
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await app.request(
        SIGN_IN_URL,
        { method: "POST", headers: [["Content-Type", "application/json"]], body: signInBody },
        signinEnv,
      );
      expect(res.status).not.toBe(429);
    }

    // IP A の6リクエスト目 → 429
    const resA = await app.request(
      SIGN_IN_URL,
      { method: "POST", headers: [["Content-Type", "application/json"]], body: signInBody },
      signinEnv,
    );
    expect(resA.status).toBe(429);

    // IP B (10.0.0.2) に切り替え → まだレートリミットに達していない
    mockConnInfo.remote.address = "10.0.0.2";
    const resB = await app.request(
      SIGN_IN_URL,
      { method: "POST", headers: [["Content-Type", "application/json"]], body: signInBody },
      signinEnv,
    );
    expect(resB.status).not.toBe(429);
  });

  it("認証済みセッションが存在してもsign-inエンドポイントはIPでレートリミットされる", async () => {
    // セッションcookie検証が成功するように設定（認証済みユーザーのシミュレート）
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });

    vi.mocked(signInWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "user123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    mockCreateSessionCookie.mockResolvedValue("test-session-cookie");
    mockDbWithUserInsert();

    // IP単位でカウントするモックenv
    let callCount = 0;
    const RATE_LIMIT = 5;
    const signinEnv = {
      ...env,
      AUTH_SIGNIN_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async () => {
          callCount++;
          return { success: callCount <= RATE_LIMIT };
        }),
      },
    };

    const SIGN_IN_URL = new URL("/api/auth/sign-in", "http://localhost:3001");
    const signInBody = JSON.stringify({ email: "test@example.com", password: "password123" });

    // 認証済みcookie付きで5リクエスト → 全て成功
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await app.request(
        SIGN_IN_URL,
        {
          method: "POST",
          headers: [
            ["Content-Type", "application/json"],
            ["Cookie", "otography_session=valid-session-cookie"],
          ],
          body: signInBody,
        },
        signinEnv,
      );
      expect(res.status).not.toBe(429);
    }

    // 6リクエスト目 → IPベースで429
    const res = await app.request(
      SIGN_IN_URL,
      {
        method: "POST",
        headers: [
          ["Content-Type", "application/json"],
          ["Cookie", "otography_session=valid-session-cookie"],
        ],
        body: signInBody,
      },
      signinEnv,
    );
    expect(res.status).toBe(429);

    // キーがIPアドレスであることを確認（ユーザーIDではない）
    expect(signinEnv.AUTH_SIGNIN_RATE_LIMITER.limit).toHaveBeenCalledWith({
      key: "10.0.0.1",
    });
  });
});

// ===========================================================================
// VAL-CROSS-004: 未認証リクエストはコンテンツエンドポイントで401を返す (429ではない)
// ===========================================================================

describe("VAL-CROSS-004: 未認証リクエストはコンテンツエンドポイントで401を返す", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の POST /api/posts は401を返し、429ではない", async () => {
    const mockEnv = createCountingMockEnv("CONTENT_RATE_LIMITER", 30);

    // セッションcookieなしでリクエスト
    const res = await app.request(
      new URL("/api/posts", "http://localhost:3001"),
      {
        method: "POST",
        headers: [["Content-Type", "application/json"]],
        body: JSON.stringify({ appleMusicId: "am-song-001", content: "Test post" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({
      type: "https://api.otography.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "You are not logged in.",
    });
  });

  it("未認証リクエストはレートリミットカウンターを消費しない", async () => {
    const mockEnv = createCountingMockEnv("CONTENT_RATE_LIMITER", 30);

    // 未認証リクエストを複数回送信
    for (let i = 0; i < 5; i++) {
      await app.request(
        new URL("/api/posts", "http://localhost:3001"),
        {
          method: "POST",
          headers: [["Content-Type", "application/json"]],
          body: JSON.stringify({ appleMusicId: "am-song-001", content: "Test post" }),
        },
        mockEnv,
      );
    }

    // CONTENT_RATE_LIMITER.limit は一度も呼ばれていないはず
    // （rateLimitByUser が requireAuthMiddleware の後に実行され、
    //   requireAuthMiddleware が未認証を弾くため）
    expect(mockEnv.CONTENT_RATE_LIMITER.limit).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// VAL-CROSS-005: wrangler.jsonc のレートリミットバインディング設定検証
// ===========================================================================
//
// cloudflare:test の miniflare 環境は仮想ファイルシステムを使用するため、
// wrangler.jsonc を直接読み込むことができない。
// そのため、wrangler.jsonc に設定されたバインディングが env オブジェクトに
// 正しくバインドされているかをランタイムで検証する。
// また、各バインディングが Cloudflare RateLimit インターフェース
// ({ limit: (opts) => Promise<{success: boolean}> }) を満たすことを確認する。
// wrangler.jsonc の静的設定値（閾値など）は worker-configuration.d.ts の型定義と
// 既存のレートリミットテスト群（閾値を直接検証）で担保される。
// ===========================================================================

describe("VAL-CROSS-005: レートリミットバインディングが正しく設定されている", () => {
  /** 期待される5つのバインディング名 */
  const requiredBindings = [
    "LIKE_RATE_LIMITER",
    "AUTH_SIGNIN_RATE_LIMITER",
    "AUTH_SIGNUP_RATE_LIMITER",
    "AUTH_GOOGLE_RATE_LIMITER",
    "CONTENT_RATE_LIMITER",
  ] as const;

  it("5つのRateLimitバインディングが全てenvに存在する", () => {
    for (const name of requiredBindings) {
      expect(env[name]).toBeDefined();
      expect(typeof env[name]?.limit).toBe("function");
    }
  });

  it("各バインディングがRateLimitインターフェース(limit関数)を持つ", async () => {
    for (const name of requiredBindings) {
      const binding = env[name];
      expect(binding).toBeDefined();
      // miniflare のモック RateLimit は limit() を呼び出せる
      const result = await binding!.limit({ key: "test-validation-key" });
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    }
  });
});
