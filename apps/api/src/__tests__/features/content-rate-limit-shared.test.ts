import { env } from "cloudflare:test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockVerifySessionCookie } from "../setup";

// ユースケース層をモック - レートリミットテストではDB操作は不要
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

vi.mock("../../features/artists/usecase", () => ({
  registerArtist: vi.fn(async () => ({
    artist: {
      id: "artist-uuid-1",
      name: "Test Artist",
      appleMusicId: "am-test-001",
      ipiCode: null,
      type: null,
      gender: null,
      birthplace: null,
      birthdate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })),
  getArtists: vi.fn(),
  getArtist: vi.fn(),
  modifyArtist: vi.fn(),
  removeArtist: vi.fn(),
}));

vi.mock("../../features/songs/usecase", () => ({
  registerSong: vi.fn(async () => ({
    song: {
      id: "song-uuid-1",
      title: "Test Song",
      appleMusicId: "am-test-001",
      length: 180,
      isrcs: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })),
  getSongs: vi.fn(),
  getSong: vi.fn(),
  syncSong: vi.fn(),
}));

// Apple Music API もモック
vi.mock("../../shared/apple-music", () => ({
  fetchArtist: vi.fn(),
  fetchSong: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: {}, end: async () => undefined })),
}));

// モック適用後にテスト対象をインポート
import { app } from "../../index";

/** CONTENT_RATE_LIMITER の閾値 */
const RATE_LIMIT = 30;

/**
 * モック用の共通env型
 * CONTENT_RATE_LIMITER.limit は { key: string } を受け取る
 */
type MockRateLimitEnv = typeof env & {
  CONTENT_RATE_LIMITER: {
    limit: ReturnType<typeof vi.fn<(opts: { key: string }) => Promise<{ success: boolean }>>>;
  };
};

/**
 * 共有カウンター付きレートリミットモックenvを作成
 *
 * posts, artists, songs 全て同じ CONTENT_RATE_LIMITER を参照するため、
 * 複数エンドポイントにまたがるリクエストでも単一のカウンターで追跡される。
 * RATE_LIMIT回まではsuccess=true、それ以降はsuccess=falseを返す
 */
const createSharedCounterMockEnv = (): MockRateLimitEnv => {
  let callCount = 0;
  return {
    ...env,
    CONTENT_RATE_LIMITER: {
      limit: vi.fn(async (_opts: { key: string }) => {
        callCount++;
        return { success: callCount <= RATE_LIMIT };
      }),
    },
  };
};

/**
 * ユーザーごとに独立したカウンターを持つレートリミットモックenvを作成
 * key ごとに独立して呼び出し回数を追跡し、RATE_LIMIT回まではsuccess=true
 */
const createPerUserCounterMockEnv = (): MockRateLimitEnv => {
  const counters = new Map<string, number>();
  return {
    ...env,
    CONTENT_RATE_LIMITER: {
      limit: vi.fn(async (opts: { key: string }) => {
        const count = (counters.get(opts.key) ?? 0) + 1;
        counters.set(opts.key, count);
        return { success: count <= RATE_LIMIT };
      }),
    },
  };
};

const POSTS_URL = new URL("/api/posts", "http://localhost:3001");
const ARTISTS_URL = new URL("/api/artists", "http://localhost:3001");
const SONGS_URL = new URL("/api/songs", "http://localhost:3001");

const makePostRequest = (mockEnv: MockRateLimitEnv, sessionCookie = "valid-session-cookie") =>
  app.request(
    POSTS_URL,
    {
      method: "POST",
      headers: [
        ["Content-Type", "application/json"],
        ["Cookie", `otography_session=${sessionCookie}`],
      ],
      body: JSON.stringify({ appleMusicId: "am-song-001", content: "Test post" }),
    },
    mockEnv,
  );

const makeArtistRequest = (mockEnv: MockRateLimitEnv, sessionCookie = "valid-session-cookie") =>
  app.request(
    ARTISTS_URL,
    {
      method: "POST",
      headers: [
        ["Content-Type", "application/json"],
        ["Cookie", `otography_session=${sessionCookie}`],
      ],
      body: JSON.stringify({ appleMusicId: "am-test-001" }),
    },
    mockEnv,
  );

const makeSongRequest = (mockEnv: MockRateLimitEnv, sessionCookie = "valid-session-cookie") =>
  app.request(
    SONGS_URL,
    {
      method: "POST",
      headers: [
        ["Content-Type", "application/json"],
        ["Cookie", `otography_session=${sessionCookie}`],
      ],
      body: JSON.stringify({ appleMusicId: "am-test-001" }),
    },
    mockEnv,
  );

describe("コンテンツエンドポイント間の共有レートリミットカウンター (VAL-CONTENT-006, VAL-CONTENT-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // セッションcookie検証が成功するようにモック
    mockVerifySessionCookie.mockResolvedValue({
      sub: "firebase-user-1",
      email: "test@example.com",
    });
  });

  describe("VAL-CONTENT-006: 複数コンテンツエンドポイントがCONTENT_RATE_LIMITERを共有する", () => {
    it("15件の投稿 + 15件のアーティスト作成後、次の楽曲作成は429を返す", async () => {
      const mockEnv = createSharedCounterMockEnv();

      // 15件の投稿作成: 全て201
      for (let i = 0; i < 15; i++) {
        const res = await makePostRequest(mockEnv);
        expect(res.status).toBe(201);
      }

      // 15件のアーティスト作成: 全て201 (合計30件 = RATE_LIMIT)
      for (let i = 0; i < 15; i++) {
        const res = await makeArtistRequest(mockEnv);
        expect(res.status).toBe(201);
      }

      // 次の楽曲作成: 共有カウンターが30に達しているため429
      const res = await makeSongRequest(mockEnv);
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({
        type: "https://api.otography.com/errors/rate-limit-exceeded",
        title: "Rate Limit Exceeded",
        status: 429,
        detail: "Too many requests. Please try again later.",
      });
    });

    it("CONTENT_RATE_LIMITER.limitがエンドポイントを跨いで合計31回呼ばれる", async () => {
      const mockEnv = createSharedCounterMockEnv();

      // 15件の投稿 + 15件のアーティスト + 1件の楽曲(429)
      for (let i = 0; i < 15; i++) {
        await makePostRequest(mockEnv);
      }
      for (let i = 0; i < 15; i++) {
        await makeArtistRequest(mockEnv);
      }
      await makeSongRequest(mockEnv);

      // CONTENT_RATE_LIMITER.limit は31回呼ばれる (15 + 15 + 1)
      expect(mockEnv.CONTENT_RATE_LIMITER.limit).toHaveBeenCalledTimes(31);
    });
  });

  describe("VAL-CONTENT-007: 異なるユーザーは独立したコンテンツレートリミットを持つ", () => {
    it("ユーザーAがレートリミットを使い切っても、ユーザーBはコンテンツ作成できる", async () => {
      const mockEnv = createPerUserCounterMockEnv();

      // ユーザーAとして30件の投稿を作成
      for (let i = 0; i < RATE_LIMIT; i++) {
        const res = await makePostRequest(mockEnv, "session-user-a");
        expect(res.status).toBe(201);
      }

      // ユーザーAの31リクエスト目は429
      const userAExhausted = await makePostRequest(mockEnv, "session-user-a");
      expect(userAExhausted.status).toBe(429);

      // ユーザーBはまだレートリミットに影響されていない
      mockVerifySessionCookie.mockResolvedValue({
        sub: "firebase-user-2",
        email: "user-b@example.com",
      });
      const userBRes = await makePostRequest(mockEnv, "session-user-b");
      expect(userBRes.status).toBe(201);
    });
  });
});
