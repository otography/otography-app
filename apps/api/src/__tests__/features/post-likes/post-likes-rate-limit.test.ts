import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie } from "../../setup";

// ユースケース層をモック - レートリミットテストではDB操作は不要
vi.mock("../../../features/post-likes/usecase", () => ({
  toggleLike: vi.fn(async () => ({ liked: true, likeCount: 1 })),
}));

// モック適用後にテスト対象をインポート
import { app } from "../../../index";

/** LIKE_RATE_LIMITER の閾値 */
const RATE_LIMIT = 30;

/** モック用のレートリミット関数型 */
type MockLimitFn = (opts: { key: string }) => Promise<{ success: boolean }>;

/**
 * LIKE_RATE_LIMITER のモック付きテスト用envを作成
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createLikeRateLimitMockEnv = () => {
  let callCount = 0;
  return {
    ...env,
    LIKE_RATE_LIMITER: {
      limit: vi.fn<MockLimitFn>(async () => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

/**
 * ユーザーごとに独立したカウンターを持つLIKE_RATE_LIMITERモックenvを作成
 * keyごとに独立して呼び出し回数を追跡する
 */
const createPerUserLikeRateLimitMockEnv = () => {
  const counters = new Map<string, number>();
  return {
    ...env,
    LIKE_RATE_LIMITER: {
      limit: vi.fn<MockLimitFn>(async (opts) => {
        const count = (counters.get(opts.key) ?? 0) + 1;
        counters.set(opts.key, count);
        return { success: count <= RATE_LIMIT };
      }),
    },
  };
};

/** テスト用モックenv型 */
type MockEnv = ReturnType<typeof createLikeRateLimitMockEnv>;

const postId = "6f648f36-5be1-4af1-bf5d-cf8ebf222221";

const makeLikeRequest = (mockEnv: MockEnv, sessionCookie = "valid-session-cookie") =>
  app.request(
    new URL(`/api/posts/${postId}/like`, "http://localhost:3001"),
    {
      method: "POST",
      headers: [["Cookie", `otography_session=${sessionCookie}`]],
    },
    mockEnv,
  );

describe("POST /api/posts/:id/like レートリミット (VAL-REFACTOR-001, VAL-REFACTOR-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // セッションcookie検証が成功するようにモック
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });
  });

  it("同一ユーザーから30リクエストは成功し、31リクエスト目は429を返す (VAL-REFACTOR-001)", async () => {
    const mockEnv = createLikeRateLimitMockEnv();

    // 30リクエスト: レートリミット内なので全て成功
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeLikeRequest(mockEnv);
      expect(res.status).toBe(200);
    }

    // 31リクエスト目: レートリミット超過で429
    const res = await makeLikeRequest(mockEnv);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/too-many-requests",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests. Please try again later.",
    });
  });

  it("レートリミット超過時のエラーレスポンスが正しい形式である", async () => {
    const mockEnv = createLikeRateLimitMockEnv();

    // 30リクエストで制限に到達
    for (let i = 0; i < RATE_LIMIT; i++) {
      await makeLikeRequest(mockEnv);
    }

    const res = await makeLikeRequest(mockEnv);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({
      type: "https://api.otography.com/errors/too-many-requests",
      title: "Too Many Requests",
      status: 429,
    });
  });

  it("異なるユーザーは独立したレートリミットを持つ (VAL-REFACTOR-002)", async () => {
    const mockEnv = createPerUserLikeRateLimitMockEnv();

    // ユーザーAとして30リクエスト: 全て成功
    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await makeLikeRequest(mockEnv, "session-user-a");
      expect(res.status).toBe(200);
    }

    // ユーザーAの31リクエスト目は429
    const userAExhausted = await makeLikeRequest(mockEnv, "session-user-a");
    expect(userAExhausted.status).toBe(429);

    // ユーザーBはまだレートリミットに影響されていない
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-2",
      email: "user-b@example.com",
    });
    const userBRes = await makeLikeRequest(mockEnv, "session-user-b");
    expect(userBRes.status).toBe(200);
  });
});

describe("LIKE_RATE_LIMITER と CONTENT_RATE_LIMITER の独立性 (VAL-REFACTOR-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });
  });

  it("CONTENT_RATE_LIMITERを使い切ってもLIKE_RATE_LIMITERは影響を受けない", async () => {
    // CONTENT_RATE_LIMITERを超過させるモックenv
    let contentCallCount = 0;
    const mockEnv = {
      ...env,
      CONTENT_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async () => {
          contentCallCount++;
          return { success: contentCallCount <= 30 };
        }),
      },
      LIKE_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async () => ({ success: true })),
      },
    };

    // CONTENT_RATE_LIMITERを30回消費
    for (let i = 0; i < 30; i++) {
      await mockEnv.CONTENT_RATE_LIMITER.limit({ key: "firebase-user-1" });
    }

    // LIKE_RATE_LIMITERはまだ使用可能
    const likeResult = await mockEnv.LIKE_RATE_LIMITER.limit({ key: "firebase-user-1" });
    expect(likeResult.success).toBe(true);

    // CONTENT_RATE_LIMITERは超過している
    const contentResult = await mockEnv.CONTENT_RATE_LIMITER.limit({ key: "firebase-user-1" });
    expect(contentResult.success).toBe(false);
  });

  it("LIKE_RATE_LIMITERを使い切ってもCONTENT_RATE_LIMITERは影響を受けない", async () => {
    let likeCallCount = 0;
    const mockEnv = {
      ...env,
      LIKE_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async () => {
          likeCallCount++;
          return { success: likeCallCount <= 30 };
        }),
      },
      CONTENT_RATE_LIMITER: {
        limit: vi.fn<MockLimitFn>(async () => ({ success: true })),
      },
    };

    // LIKE_RATE_LIMITERを30回消費
    for (let i = 0; i < 30; i++) {
      await mockEnv.LIKE_RATE_LIMITER.limit({ key: "firebase-user-1" });
    }

    // CONTENT_RATE_LIMITERはまだ使用可能
    const contentResult = await mockEnv.CONTENT_RATE_LIMITER.limit({ key: "firebase-user-1" });
    expect(contentResult.success).toBe(true);

    // LIKE_RATE_LIMITERは超過している
    const likeResult = await mockEnv.LIKE_RATE_LIMITER.limit({ key: "firebase-user-1" });
    expect(likeResult.success).toBe(false);
  });
});
