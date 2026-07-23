import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  isSecure: boolean = false,
): NextRequest {
  const base = isSecure ? "https://localhost:3000" : "http://localhost:3000";
  const cookieName = isSecure ? "__Host-otography_session" : "otography_session";
  const cookies = new Map<string, { name: string; value: string }>();
  if (sessionCookieValue !== undefined) {
    cookies.set(cookieName, { name: cookieName, value: sessionCookieValue });
  }
  return {
    nextUrl: {
      pathname: path,
      protocol: isSecure ? "https:" : "http:",
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

  describe("保護パス — オペークセッションCookieあり", () => {
    it("/account は next() を返す（開発環境）", () => {
      proxy(createRequest("/account", "opaque-session-id"));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("/account は next() を返す（本番環境 __Host- プレフィックス）", () => {
      proxy(createRequest("/account", "opaque-session-id", true));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("保護パス — セッションCookieなし", () => {
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
    it("セッションCookie が空文字ならリダイレクトされる", () => {
      proxy(createRequest("/account", ""));
      expect(mockRedirect).toHaveBeenCalled();
    });
  });

  describe("旧リフレッシュトークンCookieはチェックしない", () => {
    it("旧 otography_refresh_token のみがあってもリダイレクトされる", () => {
      // 新システムではリフレッシュトークンCookieをチェックしない
      const base = "http://localhost:3000";
      const cookies = new Map<string, { name: string; value: string }>();
      cookies.set("otography_refresh_token", {
        name: "otography_refresh_token",
        value: "old-refresh",
      });
      const req = {
        nextUrl: {
          pathname: "/account",
          protocol: "http:",
          clone: () => new URL("/account", base),
        },
        cookies: {
          get: (name: string) => cookies.get(name),
        },
      } as NextRequest;

      proxy(req);
      expect(mockRedirect).toHaveBeenCalled();
    });
  });
});
