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

import { signUpWithPassword } from "../../../shared/firebase-rest";

describe("POST /api/auth/sign-up", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("error passthrough", () => {
		it("returns 401 when signUpWithPassword returns AuthRestError", async () => {
			const { AuthRestError } = await import("@repo/errors");
			vi.mocked(signUpWithPassword).mockResolvedValue(
				new AuthRestError({ message: "Invalid email address or password.", statusCode: 401 }),
			);

			const res = await testRequest("/api/auth/sign-up", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(401);
		});

		it("returns 409 when email already exists", async () => {
			const { AuthRestError } = await import("@repo/errors");
			vi.mocked(signUpWithPassword).mockResolvedValue(
				new AuthRestError({
					message: "This email address is already registered.",
					statusCode: 409,
				}),
			);

			const res = await testRequest("/api/auth/sign-up", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(409);
		});
	});

	describe("upstream dependency failure", () => {
		it("returns 502 when createSessionCookie fails", async () => {
			vi.mocked(signUpWithPassword).mockResolvedValue({
				idToken: "test-id-token",
				localId: "user123",
				expiresIn: "3600",
				refreshToken: "test-refresh",
			});
			mockCreateSessionCookie.mockRejectedValue(new Error("Firebase error"));

			const res = await testRequest("/api/auth/sign-up", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(502);
		});
	});

	describe("success", () => {
		it("returns 201 with session cookie", async () => {
			vi.mocked(signUpWithPassword).mockResolvedValue({
				idToken: "test-id-token",
				localId: "user123",
				expiresIn: "3600",
				refreshToken: "test-refresh",
				isNewUser: true,
			});
			mockCreateSessionCookie.mockResolvedValue("test-session-cookie");

			const res = await testRequest("/api/auth/sign-up", {
				method: "POST",
				body: { email: "test@example.com", password: "password123" },
			});

			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ message: "Account created successfully." });
			expect(res.getCookie("otography_session")).toBe("test-session-cookie");
		});
	});
});
