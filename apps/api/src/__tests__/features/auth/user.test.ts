import { describe, expect, it, vi } from "vitest";
import { mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));
import { createDb } from "../../../shared/db";

// withRls が createDb().transaction() → tx.execute() × 2 → callback(tx) の順で呼ぶためのモック
const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    transaction: vi.fn(async (fn) => fn(txMethods)),
  } as never);
};

// selectUserByUsername など withRls を使わず直接 select するクエリ用のモック
const mockDbWithSelect = (resolvedValue: unknown[]) => {
  vi.mocked(createDb).mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(resolvedValue),
        })),
      })),
    })),
  } as never);
};

describe("GET /api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest("/api/user");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "You are not logged in." });
  });

  it("returns 401 when session cookie is invalid", async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error("Invalid session"));

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "invalid-session" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 200 with user profile when session is valid", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/photo.jpg",
    });
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "uuid-user",
                firebaseId: "user123",
                username: "test",
                name: null,
                bio: null,
                birthplace: null,
                birthyear: null,
                gender: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                deletedAt: null,
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("You are logged in!");
    expect(body.profile).toMatchObject({
      username: "test",
      email: "test@example.com",
      photoUrl: "https://example.com/photo.jpg",
    });
  });

  it("returns 500 when user upsert fails", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to fetch user profile." });
  });
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest("/api/user/profile", {
      method: "PATCH",
      body: { username: "test", name: "Test" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid profile data", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });

    const res = await testRequest("/api/user/profile", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { username: "", name: "" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Invalid profile data." });
  });

  it("returns 200 with profile on success", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "uuid-user",
                firebaseId: "user123",
                username: "newuser",
                name: "New User",
                bio: null,
                birthplace: null,
                birthyear: null,
                gender: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                deletedAt: null,
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user/profile", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { username: "newuser", name: "New User" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      message: "Profile updated.",
      profile: { username: "newuser", name: "New User" },
    });
  });

  it("returns 500 when DB insert fails", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user/profile", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { username: "newuser", name: "New User" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to create profile." });
  });
});

describe("PATCH /api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest("/api/user", {
      method: "PATCH",
      body: { bio: "Hello" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 200 with updated profile on success", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "uuid-user",
                firebaseId: "user123",
                username: "test",
                name: "Test User",
                bio: "Updated bio",
                birthplace: "Tokyo",
                birthyear: 1990,
                gender: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
                deletedAt: null,
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { bio: "Updated bio", birthplace: "Tokyo" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      message: "Profile updated.",
      profile: { username: "test", bio: "Updated bio", birthplace: "Tokyo" },
    });
  });

  it("returns 500 when DB update fails", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { bio: "Updated bio" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to update profile." });
  });
});

describe("DELETE /api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await testRequest("/api/user", { method: "DELETE" });

    expect(res.status).toBe(401);
  });

  it("returns 200 on success", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: "uuid-user",
                firebaseId: "user123",
                username: "test",
                name: "Test User",
                bio: null,
                birthplace: null,
                birthyear: null,
                gender: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-03T00:00:00.000Z"),
                deletedAt: new Date("2026-01-03T00:00:00.000Z"),
              },
            ]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Account deleted." });
  });

  it("returns 500 when DB delete fails", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithTransaction({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "DELETE",
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to delete account." });
  });
});

describe("GET /api/users/:username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with public profile", async () => {
    mockDbWithSelect([
      {
        id: "uuid-user",
        firebaseId: "user123",
        username: "testuser",
        name: "Test User",
        bio: "Hello world",
        birthplace: "Tokyo",
        birthyear: 1990,
        gender: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        deletedAt: null,
      },
    ]);

    const res = await testRequest("/api/users/testuser");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      profile: { username: "testuser", name: "Test User", bio: "Hello world" },
    });
  });

  it("returns 404 when user not found", async () => {
    mockDbWithSelect([]);

    const res = await testRequest("/api/users/nonexistent");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "User not found." });
  });
});
