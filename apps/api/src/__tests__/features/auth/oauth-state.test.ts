import { describe, expect, it } from "vitest";
import {
  generateOAuthState,
  verifyOAuthState,
  type OAuthStatePayload,
} from "../../../shared/auth/oauth-state";

const TEST_SECRET = "test-oauth-state-secret-at-least-32-chars";

// テスト内でgenerateOAuthStateの結果を安全に文字列として取得するヘルパー
// generateOAuthStateは失敗しない前提だが、戻り型が OAuthStateError | GeneratedOAuthState のため型ガードが必要
const generateState = async (secret: string, redirect?: string) => {
  const result = await generateOAuthState(secret, redirect);
  if (result instanceof Error) throw result;
  return result;
};

const generateToken = async (secret: string, redirect?: string): Promise<string> => {
  const { token } = await generateState(secret, redirect);
  return token;
};

describe("generateOAuthState", () => {
  it("署名済みJWT文字列を返す", async () => {
    const token = await generateToken(TEST_SECRET);

    expect(typeof token).toBe("string");
    // JWTは3つのdot-separatedセクション（header.payload.signature）で構成される
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("デフォルトのredirectとして/accountを含む", async () => {
    const token = await generateToken(TEST_SECRET);
    const payload = await verifyOAuthState(TEST_SECRET, token);

    expect(payload).not.toBeInstanceOf(Error);
    expect((payload as OAuthStatePayload).redirect).toBe("/account");
  });

  it("カスタムredirectをペイロードに含む", async () => {
    const token = await generateToken(TEST_SECRET, "/custom-path");
    const payload = await verifyOAuthState(TEST_SECRET, token);

    expect(payload).not.toBeInstanceOf(Error);
    expect((payload as OAuthStatePayload).redirect).toBe("/custom-path");
  });

  it("nonceがランダムUUIDとして含まれる", async () => {
    const { nonce } = await generateState(TEST_SECRET);
    // UUID形式（8-4-4-4-12）の検証
    expect(nonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("iatとexpクレームを含み、exp - iat === 300（5分）である", async () => {
    const token = await generateToken(TEST_SECRET);
    const payload = await verifyOAuthState(TEST_SECRET, token);

    expect(payload).not.toBeInstanceOf(Error);
    const state = payload as OAuthStatePayload;
    expect(state.exp - state.iat).toBe(300);
  });

  it("HS256アルゴリズムで署名される", async () => {
    const token = await generateToken(TEST_SECRET);
    // ヘッダーをデコードしてalgを確認
    const headerB64 = token.split(".")[0]!;
    const header = JSON.parse(atob(headerB64));

    expect(header.alg).toBe("HS256");
  });
});

describe("verifyOAuthState", () => {
  it("有効なトークンのペイロードを返す", async () => {
    const token = await generateToken(TEST_SECRET);
    const payload = await verifyOAuthState(TEST_SECRET, token);

    expect(payload).not.toBeInstanceOf(Error);
    expect(payload as OAuthStatePayload).toMatchObject({
      redirect: "/account",
    });
    expect(typeof (payload as OAuthStatePayload).nonce).toBe("string");
    expect(typeof (payload as OAuthStatePayload).iat).toBe("number");
    expect(typeof (payload as OAuthStatePayload).exp).toBe("number");
  });

  it("期限切れトークンに対してErrorを返す", async () => {
    // joseで直接期限切れJWTを生成（expを過去に設定）
    const { SignJWT } = await import("jose");
    const secretKey = new TextEncoder().encode(TEST_SECRET);
    const expiredJwt = await new SignJWT({ nonce: "test", redirect: "/account" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .sign(secretKey);

    const result = await verifyOAuthState(TEST_SECRET, expiredJwt);

    expect(result).toBeInstanceOf(Error);
  });

  it("改ざんされたトークンに対してErrorを返す", async () => {
    const token = await generateToken(TEST_SECRET);
    // シグネチャ部分を改ざん
    const parts = token.split(".");
    parts[2] = parts[2]!.slice(0, -4) + "xxxx";
    const tamperedToken = parts.join(".");

    const result = await verifyOAuthState(TEST_SECRET, tamperedToken);

    expect(result).toBeInstanceOf(Error);
  });

  it("異なるシークレットで署名されたトークンに対してErrorを返す", async () => {
    const token = await generateToken("different-secret-at-least-32-characters");
    const result = await verifyOAuthState(TEST_SECRET, token);

    expect(result).toBeInstanceOf(Error);
  });

  it("不正なフォーマットのトークンに対してErrorを返す", async () => {
    const result = await verifyOAuthState(TEST_SECRET, "not-a-valid-jwt");

    expect(result).toBeInstanceOf(Error);
  });

  it("クレーム欠落のトークンに対してErrorを返す", async () => {
    // nonceが欠落したJWTを直接生成
    const { SignJWT } = await import("jose");
    const secretKey = new TextEncoder().encode(TEST_SECRET);
    const malformedJwt = await new SignJWT({ redirect: "/account" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
      .sign(secretKey);

    const result = await verifyOAuthState(TEST_SECRET, malformedJwt);

    expect(result).toBeInstanceOf(Error);
  });
});

describe("generateOAuthState 戻り値の構造", () => {
  it("{ nonce, token } のオブジェクトを返す", async () => {
    const result = await generateState(TEST_SECRET);

    expect(result).toHaveProperty("nonce");
    expect(result).toHaveProperty("token");
    expect(typeof result.nonce).toBe("string");
    expect(typeof result.token).toBe("string");
  });

  it("token内のnonceと戻り値のnonceが一致する", async () => {
    const { nonce, token } = await generateState(TEST_SECRET);
    const payload = await verifyOAuthState(TEST_SECRET, token);

    expect(payload).not.toBeInstanceOf(Error);
    expect((payload as OAuthStatePayload).nonce).toBe(nonce);
  });
});
