import { describe, expect, it, vi } from "vitest";
import { mockResolveSession } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase/firebase-rest", () => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDbClient: vi.fn(),
}));

import { createDbClient } from "../../../shared/db";

// リフレッシュ成功時にルートハンドラがDBにアクセスするためのモック
const mockDbWithRls = (uuid: string, txMethods: Record<string, unknown>) => {
  vi.mocked(createDbClient).mockReturnValue({
    db: {
      execute: vi.fn(() => Promise.resolve([{ resolve_firebase_id: uuid }])),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: uuid }]),
          })),
        })),
      })),
      transaction: vi.fn(async (fn) => fn(txMethods)),
    },
    end: async () => undefined,
  } as never);
};

const defaultDbTx = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([
          {
            id: "uuid-user",
            firebaseId: "user123",
            username: "test",
            name: "Test User",
            bio: null,
            birthplace: null,
            birthyear: null,
            gender: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            deletedAt: null,
          },
        ]),
      })),
    })),
  })),
  execute: vi.fn().mockResolvedValue([]),
};

describe("Session resolution on protected route (GET /api/user)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when resolveSession returns valid claims", async () => {
    mockResolveSession.mockResolvedValue({
      claims: { sub: "user123", email: "test@example.com" },
      session: { id: "session-uuid", userId: "uuid-user", version: 1 },
    });
    mockDbWithRls("uuid-user", defaultDbTx);

    const res = await testRequest("/api/user", {
      cookie: { otography_session: "a".repeat(43) },
    });

    expect(res.status).toBe(200);
  });

  it("returns 401 when resolveSession returns null (no valid session)", async () => {
    mockResolveSession.mockResolvedValue(null);

    const res = await testRequest("/api/user");

    expect(res.status).toBe(401);
  });

  it("returns 401 when no opaque cookie is present", async () => {
    mockResolveSession.mockResolvedValue(null);

    const res = await testRequest("/api/user");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: "https://api.otography.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "You are not logged in.",
    });
  });
});
