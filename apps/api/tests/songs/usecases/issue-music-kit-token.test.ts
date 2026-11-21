import { describe, expect, test } from "vite-plus/test";
import { DeveloperTokenError } from "../../../src/lib/apple-music/errors.ts";
import { issueMusicKitToken } from "../../../src/songs/usecases/issue-music-kit-token.ts";

describe("issueMusicKitToken", () => {
  test("リクエストのオリジンに限定したトークンを発行する", async () => {
    const origins: Array<string | null> = [];
    const token = await issueMusicKitToken({
      origin: "https://app.otography.workers.dev",
      getDeveloperToken: async ({ origin }) => {
        origins.push(origin);
        return { token: "t", expiresAt: 1 };
      },
    });

    expect(origins).toEqual(["https://app.otography.workers.dev"]);
    expect(token).toEqual({ token: "t", expiresAt: 1 });
  });

  test("トークンを作れないときは、そのエラーを返す", async () => {
    const token = await issueMusicKitToken({
      origin: "http://localhost:3000",
      getDeveloperToken: async () => new DeveloperTokenError(),
    });

    expect(token).toBeInstanceOf(DeveloperTokenError);
  });
});
