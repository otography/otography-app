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

vi.mock("../../../shared/db/rls", () => ({
	withRls: vi.fn(),
}));

import { withRls } from "../../../shared/db/rls";

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

		const mockProfile = {
			id: "user123",
			email: "test@example.com",
			displayName: "Test User",
			photoUrl: "https://example.com/photo.jpg",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		vi.mocked(withRls).mockResolvedValue([mockProfile]);

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

	it("returns 500 when withRls fails", async () => {
		const { RlsError } = await import("@repo/errors");
		mockVerifySessionCookie.mockResolvedValue({
			sub: "user123",
			email: "test@example.com",
		});
		vi.mocked(withRls).mockResolvedValue(new RlsError({ message: "RLS policy violation." }));

		const res = await testRequest("/api/user", {
			cookie: { otography_session: "valid-session" },
		});

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ message: "Failed to fetch user profile." });
	});
});
