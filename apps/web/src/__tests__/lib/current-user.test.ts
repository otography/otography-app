// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
  },
}));

import { getCurrentUser } from "../../lib/current-user";

const validResponse = {
  message: "You are logged in!",
  userId: "user123",
  profile: {
    id: "user123",
    email: "test@example.com",
    displayName: "Test User",
    photoUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

function createFetchResponse(status: number, body?: unknown): globalThis.Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("getCurrentUser", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("successful fetch", () => {
    it("returns parsed user data when response is 200", async () => {
      mockCookies.mockResolvedValue({ toString: () => "otography_session=valid" });
      mockFetch.mockResolvedValue(createFetchResponse(200, validResponse));

      const result = await getCurrentUser();

      expect(result).toEqual(validResponse);
    });

    it("forwards cookies from cookieStore in request headers", async () => {
      mockCookies.mockResolvedValue({ toString: () => "otography_session=session-value" });
      mockFetch.mockResolvedValue(createFetchResponse(200, validResponse));

      await getCurrentUser();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0] as [URL, RequestInit];
      expect(call[0].toString()).toBe("http://localhost:3001/api/user");
      expect((call[1].headers as Record<string, string>).cookie).toBe(
        "otography_session=session-value",
      );
    });

    it("uses NEXT_PUBLIC_API_URL to construct the request URL", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(200, validResponse));

      await getCurrentUser();

      const call = mockFetch.mock.calls[0] as [URL];
      expect(call[0].toString()).toMatch(/^http:\/\/localhost:3001\/api\/user/);
    });
  });

  describe("unauthenticated", () => {
    it("returns null when response status is 401", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(401));

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe("server errors", () => {
    it("throws when response is 500", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(500));

      await expect(getCurrentUser()).rejects.toThrow("Failed to fetch the current user.");
    });

    it("throws when response is any non-401 error status", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(502));

      await expect(getCurrentUser()).rejects.toThrow("Failed to fetch the current user.");
    });
  });

  describe("validation errors", () => {
    it("throws when response body does not match schema", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(200, { invalid: "data" }));

      await expect(getCurrentUser()).rejects.toThrow("Failed to parse the current user response.");
    });
  });
});
