import { env } from "cloudflare:test";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../../../shared/auth/refresh-token");

import { getRefreshTokenCookie, setRefreshTokenCookie } from "../../../shared/auth/refresh-token";

const createApp = (bindings: Record<string, string>) => {
  const app = new Hono();
  const testEnv = { ...env, ...bindings };
  return { app, testEnv };
};

describe("refresh token cookie helpers", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  it("returns typed error when AUTH_ENCRYPTION_KEY is invalid", async () => {
    const { app, testEnv } = createApp({ AUTH_ENCRYPTION_KEY: "bad-key" });
    app.get("/", async (c) => {
      const result = await setRefreshTokenCookie(c, "refresh-token");
      if (result instanceof Error) {
        return c.json(
          {
            message: result.message,
            causeTag: (result.cause as { _tag?: string } | undefined)?._tag,
          },
          500,
        );
      }
      return c.json({ ok: true });
    });

    const response = await app.request("http://localhost/", {}, testEnv);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      message: "Failed to set refresh token cookie.",
      causeTag: "RefreshTokenCookieError",
    });
  });

  it("clears cookie and returns null when refresh token decryption fails", async () => {
    const { app, testEnv } = createApp({ AUTH_ENCRYPTION_KEY: "0".repeat(64) });
    app.get("/", async (c) => {
      const token = await getRefreshTokenCookie(c);
      return c.json({ token });
    });

    const response = await app.request(
      "http://localhost/",
      { headers: { Cookie: "otography_refresh_token=deadbeef" } },
      testEnv,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: null });
    expect(response.headers.getSetCookie().join(";")).toContain("otography_refresh_token=");
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to decrypt refresh token cookie:",
      "Failed to decrypt refresh token.",
    );
  });
});
