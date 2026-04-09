// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnauthenticatedError,
  NoProfileError,
  FetchCurrentUserError,
  UnexpectedStatusError,
  JsonParseError,
} from "@repo/errors";

const { mockGetServerApi, mockUserGet } = vi.hoisted(() => ({
  mockGetServerApi: vi.fn(),
  mockUserGet: vi.fn(),
}));

vi.mock("@/lib/server-api", () => ({
  getServerApi: mockGetServerApi,
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

function createResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerApi.mockResolvedValue({
    user: { $get: mockUserGet },
  });
});

describe("getCurrentUser", () => {
  describe("successful fetch", () => {
    it("returns parsed user data when response is 200", async () => {
      mockUserGet.mockResolvedValue(createResponse(200, validResponse));

      const result = await getCurrentUser();

      expect(result).toEqual(validResponse);
    });
  });

  describe("unauthenticated", () => {
    it("returns UnauthenticatedError when response status is 401", async () => {
      mockUserGet.mockResolvedValue(createResponse(401));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnauthenticatedError);
    });

    it("returns NoProfileError when response status is 404", async () => {
      mockUserGet.mockResolvedValue(createResponse(404));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(NoProfileError);
    });
  });

  describe("network errors", () => {
    it("returns FetchCurrentUserError when RPC call rejects", async () => {
      mockUserGet.mockRejectedValue(new Error("Network error"));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(FetchCurrentUserError);
    });
  });

  describe("unexpected status codes", () => {
    it("returns UnexpectedStatusError when response is 500", async () => {
      mockUserGet.mockResolvedValue(createResponse(500));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnexpectedStatusError);
    });

    it("returns UnexpectedStatusError for any non-401/404 error status", async () => {
      mockUserGet.mockResolvedValue(createResponse(502));

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(UnexpectedStatusError);
    });
  });

  describe("json parse errors", () => {
    it("returns JsonParseError when response body is not valid JSON", async () => {
      mockUserGet.mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await getCurrentUser();

      expect(result).toBeInstanceOf(JsonParseError);
    });
  });
});
