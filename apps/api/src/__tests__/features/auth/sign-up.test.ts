import { describe, expect, it, vi } from "vitest";
import { mockIssueSession } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

vi.mock("../../../shared/middleware/rate-limit.middleware", () => ({
  rateLimitByIp: () => async (_c: unknown, next: () => Promise<void>) => await next(),
  rateLimitByUser: () => async (_c: unknown, next: () => Promise<void>) => await next(),
}));

import { signUpWithPassword } from "../../../shared/firebase/firebase-rest";
import { createDbClient } from "../../../shared/db";

const mockDbWithUserInsert = (rows: unknown[] = [{ id: "uuid-user" }]) => {
  vi.mocked(createDbClient).mockReturnValue({
    db: {
      execute: vi.fn(() => Promise.resolve([])),
      transaction: vi.fn(async (fn) =>
        fn({
          execute: vi.fn(() => Promise.resolve(rows)),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue(rows),
              })),
            })),
          })),
        }),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue(rows),
          })),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    },
    end: async () => undefined,
  } as never);
};

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbWithUserInsert();
  });

  it("returns 201 and sets opaque session cookie on success", async () => {
    vi.mocked(signUpWithPassword).mockResolvedValue({
      idToken: "test-id-token",
      localId: "newuser123",
      expiresIn: "3600",
      refreshToken: "test-refresh",
    });
    vi.mocked(mockIssueSession).mockResolvedValue({
      opaqueId: "test-opaque-id",
      session: { id: "session-uuid", userId: "uuid-user" },
    });

    const res = await testRequest("/api/auth/sign-up", {
      method: "POST",
      body: { email: "new@example.com", password: "password123" },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ message: "Account created successfully." });
    expect(res.getCookie("otography_session")).toBe("test-opaque-id");
  });

  it("returns 409 when email already registered", async () => {
    const { AuthRestError } = await import("@repo/errors");
    vi.mocked(signUpWithPassword).mockResolvedValue(
      new AuthRestError({
        message: "This email address is already registered.",
        statusCode: 409,
      }),
    );

    const res = await testRequest("/api/auth/sign-up", {
      method: "POST",
      body: { email: "existing@example.com", password: "password123" },
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid input", async () => {
    const res = await testRequest("/api/auth/sign-up", {
      method: "POST",
      body: { email: "bad", password: "12" },
    });

    expect(res.status).toBe(400);
  });
});
