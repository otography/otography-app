import { describe, expect, it, vi } from "vitest";
import { mockRevokeRefreshTokens, mockVerifySessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
	signInWithPassword: vi.fn(),
	signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
	getDb: vi.fn(),
}));

describe("POST /api/auth/sign-out", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 204 when no session cookie is present", async () => {
		const res = await testRequest("/api/auth/sign-out", {
			method: "POST",
			headers: { Origin: "http://localhost:3000" },
		});

		expect(res.status).toBe(204);
		expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
	});

	it("returns 204 and clears session cookie when session is valid", async () => {
		mockVerifySessionCookie.mockResolvedValue({ sub: "user123", email: "test@example.com" });
		mockRevokeRefreshTokens.mockResolvedValue(undefined);

		const res = await testRequest("/api/auth/sign-out", {
			method: "POST",
			headers: { Origin: "http://localhost:3000" },
			cookie: { otography_session: "valid-session" },
		});

		expect(res.status).toBe(204);
		expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("user123");
	});

	it("returns 502 when revokeRefreshTokens fails without clearCookie", async () => {
		mockVerifySessionCookie.mockResolvedValue({ sub: "user123", email: "test@example.com" });
		mockRevokeRefreshTokens.mockRejectedValue(new Error("Firebase error"));

		const res = await testRequest("/api/auth/sign-out", {
			method: "POST",
			headers: { Origin: "http://localhost:3000" },
			cookie: { otography_session: "valid-session" },
		});

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ message: "Failed to sign you out. Please try again." });
	});
});
