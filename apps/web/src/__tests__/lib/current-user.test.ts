// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnauthenticatedError,
  NoProfileError,
  FetchCurrentUserError,
  UnexpectedStatusError,
  JsonParseError,
  SchemaValidationError,
} from "@repo/errors";

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
  profile: {
    email: "test@example.com",
    name: "Test User",
    photoUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    username: "testuser",
    bio: null,
    birthplace: null,
    birthyear: null,
    gender: null,
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
    it("returns UnauthenticatedError when response status is 401", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(401));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnauthenticatedError);
    });

    it("returns NoProfileError when response status is 404", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(404));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(NoProfileError);
    });
  });

  describe("network errors", () => {
    it("returns FetchCurrentUserError when fetch rejects", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(FetchCurrentUserError);
    });
  });

  describe("unexpected status codes", () => {
    it("returns UnexpectedStatusError when response is 500", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(500));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnexpectedStatusError);
    });

    it("returns UnexpectedStatusError for any non-401/404 error status", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(502));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnexpectedStatusError);
    });
  });

  describe("json parse errors", () => {
    it("returns JsonParseError when response body is not valid JSON", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      const response = {
        status: 200,
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(JsonParseError);
    });
  });

  describe("validation errors", () => {
    it("returns SchemaValidationError when response body does not match schema", async () => {
      mockCookies.mockResolvedValue({ toString: () => "" });
      mockFetch.mockResolvedValue(createFetchResponse(200, { invalid: "data" }));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(SchemaValidationError);
    });
  });
});
