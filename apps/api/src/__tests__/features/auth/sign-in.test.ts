import { describe, expect, it, vi } from "vitest";
import { mockCreateSessionCookie } from "../../setup";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
	signInWithPassword: vi.fn(),
	signUpWithPassword: vi.fn(),
	signInWithIdp: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("../../../shared/db/rls", () => ({
	withRls: vi.fn(),
}));

import { signInWithPassword } from "../../../shared/firebase-rest";

describe("POST /api/auth/sign-in", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("error passthrough", () => {
		it("returns 401 when signInWithPassword returns AuthRestError", async () => {
			const { AuthRestError } = await import("@repo/errors");
			vi.mocked(signInWithPassword).mockResolvedValue(
				new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
			);

			const res = await testRequest("/api/auth/sign-in", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(401);
			expect(await res.json()).toEqual({ message: "Invalid email address or password." });
		});

		it("returns 409 when email already exists", async () => {
			const { AuthRestError } = await import("@repo/errors");
			vi.mocked(signInWithPassword).mockResolvedValue(
				new AuthRestError({
					message: "This email address is already registered.",
					statusCode: 409,
				}),
			);

			const res = await testRequest("/api/auth/sign-in", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(409);
		});
	});

	describe("upstream dependency failure", () => {
		it("returns 502 when createSessionCookie fails", async () => {
			vi.mocked(signInWithPassword).mockResolvedValue({
				idToken: "test-id-token",
				localId: "user123",
				expiresIn: "3600",
				refreshToken: "test-refresh",
			});
			mockCreateSessionCookie.mockRejectedValue(new Error("Firebase error"));

			const res = await testRequest("/api/auth/sign-in", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(502);
			expect(await res.json()).toEqual({ message: "Session creation failed." });
		});
	});

	describe("success", () => {
		it("returns 200 with session cookie", async () => {
			vi.mocked(signInWithPassword).mockResolvedValue({
				idToken: "test-id-token",
				localId: "user123",
				expiresIn: "3600",
				refreshToken: "test-refresh",
			});
			mockCreateSessionCookie.mockResolvedValue("test-session-cookie");

			const res = await testRequest("/api/auth/sign-in", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ message: "Signed in successfully." });
			expect(res.getCookie("otography_session")).toBe("test-session-cookie");
		});
	});
});
