import { describe, expect, it } from "vitest";
import { decodeJwt, decodeProtectedHeader } from "jose";
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
    const token = await generateWebDeveloperToken(["http://localhost:3000"]);
    const payload = decodeJwt(token);

    expect(payload.origin).toEqual(["http://localhost:3000"]);
  });

  it("TTL は 3600 秒 (1h)", async () => {
    const token = await generateWebDeveloperToken(["http://localhost:3000"]);
    const payload = decodeJwt(token);

    expect(payload.exp! - payload.iat!).toBe(60 * 60);
  });
});
