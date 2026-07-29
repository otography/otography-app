import { describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { testRequest } from "./helpers/test-client";

vi.mock("../shared/db", () => ({
  createDbClient: vi.fn(() => ({ db: {}, end: async () => undefined })),
}));

/*
 * 公開サーフェス許可リストテスト (MUS-54)
 *
 * app.routes から全エンドポイントを動的列挙し、Cookie なしでリクエストを発行。
 * 許可リストにないルートは 401 を返すことを assert する。
 * 逆方向: 許可リストの全エントリが app.routes に実在することも検証（陳腐化検出）。
 *
 * /api/apple-music/token は許可リストに含めない（認証必須化が MUS-54 の目的）。
 */

// 認証不要な (method, path) の許可リスト
const PUBLIC_ROUTE_ALLOWLIST: Set<string> = new Set([
  // health
  "GET /api/health",
  "GET /api/health/ready",
  // errors
  "GET /errors/:type",
  // auth（sign-in/up/out は CSRF・レートリミットテストでバイパスされる）
  "POST /api/auth/sign-in",
  "POST /api/auth/sign-up",
  "POST /api/auth/sign-out",
  "GET /api/auth/google",
  "GET /api/auth/google/callback",
  // 公開読み取りエンドポイント
  "GET /api/songs",
  "GET /api/songs/:id",
  "GET /api/artists",
  "GET /api/artists/:id",
  "GET /api/posts",
  "GET /api/posts/:id",
  "GET /api/users/:username",
  "GET /api/users/:userId/favorites/songs",
  "GET /api/users/:userId/favorites/artists",
]);

// パスパラメータをダミー値に置換してリクエスト可能な URL を生成
const materializePath = (path: string): string => {
  return path
    .replace(/:id/g, "550e8400-e29b-41d4-a716-446655440000")
    .replace(/:userId/g, "8f648f36-5be1-4af1-bf5d-cf8ebf211111")
    .replace(/:username/g, "testuser")
    .replace(/:appleMusicId/g, "am-test-001")
    .replace(/:type/g, "not-found");
};

// POST/PATCH/DELETE は CSRF・DB に依存しない最小ボディを付与
const buildBody = (method: string): unknown | undefined => {
  if (method === "POST" || method === "PATCH") return {};
  return undefined;
};

// テスト対象のルートを app.routes から動的抽出
const routes = [
  ...new Set(
    app.routes
      .filter((r: { method: string; path: string }) => r.method !== "ALL")
      .map((r: { method: string; path: string }) => `${r.method} ${r.path}`),
  ),
].sort() as string[];

describe("公開サーフェス許可リスト (MUS-54)", () => {
  // 逆方向 assert: 許可リストの全エントリが app.routes に実在する（陳腐化検出）
  it("許可リストの全エントリが app.routes に実在する", () => {
    const routeSet = new Set(routes);
    const stale: string[] = [];
    for (const entry of PUBLIC_ROUTE_ALLOWLIST) {
      if (!routeSet.has(entry)) {
        stale.push(entry);
      }
    }
    expect(stale).toEqual([]);
  });

  // 各ルートに Cookie なしでリクエストし、許可リスト外は 401 を確認
  it.each(routes)("Cookie なし %s → 許可リスト外は401", async (entry: string) => {
    const [method, path] = entry.split(" ") as [string, string];
    const url = materializePath(path);
    const body = buildBody(method);

    const res = await testRequest(url, {
      method,
      body,
    });

    if (PUBLIC_ROUTE_ALLOWLIST.has(entry)) {
      // 許可リスト内のルートは 401 でないことを確認
      // （400/404/500等の他のエラーは許容 — 認証で弾かれないことが重要）
      expect(res.status).not.toBe(401);
    } else {
      // 許可リスト外のルートは 401 であることを確認
      expect(res.status).toBe(401);
    }
  });
});
