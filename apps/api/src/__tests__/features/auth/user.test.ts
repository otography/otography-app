import { describe, expect, it, vi } from "vitest";
import { mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: vi.fn(),
}));
import { createDb } from "../../../shared/db";

const conditionReferencesColumn = (
  value: unknown,
  columnName: string,
  seen = new WeakSet<object>(),
): boolean => {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if ("name" in value && value.name === columnName) return true;

  if (Array.isArray(value)) {
    return value.some((item) => conditionReferencesColumn(item, columnName, seen));
  }

  return Object.values(value as Record<string, unknown>).some((item) =>
    conditionReferencesColumn(item, columnName, seen),
  );
};

// withRls の新しいモック: Firebase ID → UUID ルックアップ + トランザクション
const mockDbWithRls = (uuid: string, txMethods: Record<string, unknown>) => {
  vi.mocked(createDb).mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: uuid }]),
        })),
      })),
    })),
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
    const { AuthError } = await import("@repo/errors/server");
    mockVerifySessionCookie.mockResolvedValue(
      new AuthError({ message: "Invalid session.", code: "auth/invalid-session", statusCode: 401 }),
    );

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
    mockDbWithRls("uuid-user", {
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

  it("returns 500 when withRls fails to resolve user UUID", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    // withRls の UUID lookup が空 → RlsError → usecase が 500 にラップ
    // ※ withRls 内で lookup が空の場合は RlsError を返す
    vi.mocked(createDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    } as never);

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "valid-session" },
    });

    // withRls が "User not found" エラー → usecase が 500 にラップ
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Failed to fetch user profile." });
  });

  it("filters out deleted users while resolving the RLS UUID", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    const where = vi.fn((_: unknown) => ({
      limit: vi.fn().mockResolvedValue([]),
    }));
    vi.mocked(createDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where,
        })),
      })),
    } as never);

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "valid-session" },
    });

    expect(res.status).toBe(500);
    expect(conditionReferencesColumn(where.mock.calls[0]![0], "deleted_at")).toBe(true);
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
    mockDbWithRls("uuid-user", {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
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
    mockDbWithRls("uuid-user", {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
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

  it("returns 409 when username is already taken", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithRls("uuid-user", {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(
              createDrizzleConstraintError({
                constraintName: "users_username_key",
                query: 'update "users"',
              }),
            ),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user/profile", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { username: "existinguser", name: "Existing User" },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "Username is already taken." });
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
    mockDbWithRls("uuid-user", {
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
    mockDbWithRls("uuid-user", {
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

  it("returns 400 when DB rejects birthyear check constraint", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithRls("uuid-user", {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(
              createDrizzleConstraintError({
                code: "23514",
                constraintName: "users_birthyear_check",
                query: 'update "users"',
              }),
            ),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { birthyear: 3000 },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Invalid birthyear." });
  });

  it("returns 409 when updating username to a taken value", async () => {
    mockVerifySessionCookie.mockResolvedValue({
      sub: "user123",
      email: "test@example.com",
    });
    mockDbWithRls("uuid-user", {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(
              createDrizzleConstraintError({
                constraintName: "users_username_key",
                query: 'update "users"',
              }),
            ),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    });

    const res = await testRequest("/api/user", {
      method: "PATCH",
      cookie: { otography_session: "valid-session" },
      body: { username: "existinguser" },
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "Username is already taken." });
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
    mockDbWithRls("uuid-user", {
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
    mockDbWithRls("uuid-user", {
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
        username: "testuser",
        name: "Test User",
        bio: "Hello world",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const res = await testRequest("/api/users/testuser");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      profile: {
        username: "testuser",
        name: "Test User",
        bio: "Hello world",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns 404 when user not found", async () => {
    mockDbWithSelect([]);

    const res = await testRequest("/api/users/nonexistent");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "User not found." });
  });
});
