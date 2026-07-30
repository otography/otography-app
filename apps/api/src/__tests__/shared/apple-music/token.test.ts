import { describe, expect, it } from "vitest";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { AppleMusicError } from "@repo/errors";
import {
  generateDeveloperToken,
  generateWebDeveloperToken,
} from "../../../shared/apple-music/token";

/*
 * テストリスト: Apple Music developer token 署名
 *
 * サーバー内部用 generateDeveloperToken (24h・origin なし):
 * 0. ペイロードに origin がない
 * 0. exp - iat === 86400 (24h)
 * 0. ヘッダー kid === APPLE_KEY_ID
 * 0. iss === APPLE_TEAM_ID
 *
 * Web 配布用 generateWebDeveloperToken (1h・origin クレーム):
 * 1. origin が配列でペイロードに含まれる
 * 2. exp - iat === 3600 (1h)
 * 3. origins が空配列の場合、fail-closed で AppleMusicError を返す
 * 4. AppleMusicError の statusCode は 500（サーバー設定エラー）
 * 5. origins が空の場合、message は安全な固定メッセージ（内部設定情報を含まない）
 * 6. origins が空の場合、内部デバッグ情報は cause のみに保持される
 */
describe("generateDeveloperToken (サーバー内部用)", () => {
  it("ペイロードに origin クレームが含まれない", async () => {
    const token = await generateDeveloperToken();
    const payload = decodeJwt(token);

    expect(payload).not.toHaveProperty("origin");
  });

  it("TTL は 86400 秒 (24h)", async () => {
    const token = await generateDeveloperToken();
    const payload = decodeJwt(token);

    expect(payload.exp! - payload.iat!).toBe(60 * 60 * 24);
  });

  it("ヘッダー kid は APPLE_KEY_ID と一致する", async () => {
    const token = await generateDeveloperToken();
    const header = decodeProtectedHeader(token);

    expect(header.kid).toBe("TESTKEY1234");
  });

  it("iss は APPLE_TEAM_ID と一致する", async () => {
    const token = await generateDeveloperToken();
    const payload = decodeJwt(token);

    expect(payload.iss).toBe("TESTTEAM12");
  });
});

describe("generateWebDeveloperToken (Web配布用)", () => {
  it("ペイロードの origin が引数の配列と一致する", async () => {
    const result = await generateWebDeveloperToken(["http://localhost:3000"]);
    if (result instanceof Error) throw new Error("expected a token string but got Error");
    const payload = decodeJwt(result);

    expect(payload.origin).toEqual(["http://localhost:3000"]);
  });

  it("TTL は 3600 秒 (1h)", async () => {
    const result = await generateWebDeveloperToken(["http://localhost:3000"]);
    if (result instanceof Error) throw new Error("expected a token string but got Error");
    const payload = decodeJwt(result);

    expect(payload.exp! - payload.iat!).toBe(60 * 60);
  });

  it("origins が空配列の場合、fail-closed で AppleMusicError を返す", async () => {
    const result = await generateWebDeveloperToken([]);

    expect(result).toBeInstanceOf(AppleMusicError);
  });

  it("空配列エラーの statusCode は 500（サーバー設定エラー）", async () => {
    const result = await generateWebDeveloperToken([]);

    expect(result).toBeInstanceOf(AppleMusicError);
    if (!(result instanceof AppleMusicError)) {
      throw new Error("expected AppleMusicError");
    }
    expect(result.statusCode).toBe(500);
    expect(result.problemSlug).toBe("internal-error");
  });

  it("空配列エラーの message は安全な固定メッセージ（内部設定情報を含まない）", async () => {
    const result = await generateWebDeveloperToken([]);

    expect(result).toBeInstanceOf(AppleMusicError);
    if (!(result instanceof AppleMusicError)) {
      throw new Error("expected AppleMusicError");
    }
    expect(result.message).toBe(
      "Apple Music developer token could not be issued. Please try again later.",
    );
    // 内部設定情報が message に漏洩しないこと
    expect(result.message).not.toContain("APP_FRONTEND_URL");
    expect(result.message).not.toContain("environment variable");
    expect(result.message).not.toContain("not configured");
    expect(result.message).not.toContain("configuration");
  });

  it("空配列エラーの内部デバッグ情報は cause のみに保持される", async () => {
    const result = await generateWebDeveloperToken([]);

    expect(result).toBeInstanceOf(AppleMusicError);
    if (!(result instanceof AppleMusicError)) {
      throw new Error("expected AppleMusicError");
    }
    expect(result.cause).toBe(
      "APP_FRONTEND_URL is not configured; cannot issue a web developer token.",
    );
  });
});
