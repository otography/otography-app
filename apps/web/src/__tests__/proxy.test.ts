import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "api/auth-cookies";

// NextResponse の呼び出しを追跡
const mockNext = vi.fn();
const mockRedirect = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => mockNext(),
    redirect: (url: unknown) => mockRedirect(url),
  },
}));

const { proxy } = await import("../../proxy");

function createRequest(
  path: string,
  sessionCookieValue?: string,
  refreshTokenCookieValue?: string,
): NextRequest {
  const base = "http://localhost:3000";
  const cookies = new Map<string, { name: string; value: string }>();
  if (sessionCookieValue !== undefined) {
    cookies.set(SESSION_COOKIE_NAME, { name: SESSION_COOKIE_NAME, value: sessionCookieValue });
  }
  if (refreshTokenCookieValue !== undefined) {
    cookies.set(REFRESH_TOKEN_COOKIE_NAME, {
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: refreshTokenCookieValue,
    });
  }
  return {
    nextUrl: {
      pathname: path,
      clone: () => new URL(path, base),
    },
    cookies: {
      get: (name: string) => cookies.get(name),
    },
  } as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy", () => {
  describe("パブリックパス", () => {
    it("/login は next() を返す", () => {
      proxy(createRequest("/login"));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("/signup は next() を返す", () => {
      proxy(createRequest("/signup"));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("クッキーなしでもパブリックパスは next()", () => {
      proxy(createRequest("/login"));
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("保護パス — クッキーあり", () => {
    it("/account は next() を返す", () => {
      proxy(createRequest("/account", "valid-session"));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("refresh token cookie のみでも next() を返す", () => {
      proxy(createRequest("/account", undefined, "valid-refresh-token"));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("保護パス — クッキーなし", () => {
    it("/account は /login へリダイレクト", () => {
      proxy(createRequest("/account"));
      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0]![0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("/setup-profile は /login へリダイレクト", () => {
      proxy(createRequest("/setup-profile"));
      expect(mockRedirect).toHaveBeenCalled();
      const redirectUrl = mockRedirect.mock.calls[0]![0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
    });

    it("/ は /login へリダイレクト", () => {
      proxy(createRequest("/"));
      expect(mockRedirect).toHaveBeenCalled();
    });
  });

  describe("クッキーが空文字", () => {
    it("session cookie が空文字ならリダイレクトされる", () => {
      proxy(createRequest("/account", ""));
      expect(mockRedirect).toHaveBeenCalled();
    });

    it("refresh token cookie が空文字ならリダイレクトされる", () => {
      proxy(createRequest("/account", undefined, ""));
      expect(mockRedirect).toHaveBeenCalled();
    });
  });
});
