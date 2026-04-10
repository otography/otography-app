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

function createRequest(path: string, cookieValue?: string): NextRequest {
  const base = "http://localhost:3000";
  const cookies = new Map<string, { name: string; value: string }>();
  if (cookieValue !== undefined) {
    cookies.set("otography_session", { name: "otography_session", value: cookieValue });
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
    it("リダイレクトされる", () => {
      proxy(createRequest("/account", ""));
      expect(mockRedirect).toHaveBeenCalled();
    });
  });
});
