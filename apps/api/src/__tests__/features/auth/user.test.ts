import { describe, expect, it, vi } from "vitest";
import { mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
	signInWithPassword: vi.fn(),
	signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
	getDb: vi.fn(),
}));
import { getDb } from "../../../shared/db";

describe("GET /api/user", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(getDb).mockReturnValue({
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					onConflictDoUpdate: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([
							{
								id: "uuid-user",
								firebaseId: "user123",
								username: "test",
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
		} as never);
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

		const res = await testRequest("/api/user", {
			cookie: { otography_session: "valid-session" },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.message).toBe("You are logged in!");
		expect(body.userId).toBe("user123");
		expect(body.profile).toMatchObject({
			id: "user123",
			email: "test@example.com",
			displayName: "Test User",
			photoUrl: "https://example.com/photo.jpg",
		});
	});

	it("returns 500 when user upsert fails", async () => {
		mockVerifySessionCookie.mockResolvedValue({
			sub: "user123",
			email: "test@example.com",
		});
		vi.mocked(getDb).mockReturnValue({
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					onConflictDoUpdate: vi.fn(() => ({
						returning: vi.fn().mockRejectedValue(new Error("DB error")),
					})),
				})),
			})),
		} as never);

		const res = await testRequest("/api/user", {
			cookie: { otography_session: "valid-session" },
		});

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ message: "Failed to fetch user profile." });
	});
});
