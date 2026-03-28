import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/firebase-auth-rest/auth", () => ({
	FirebaseAuthError: class extends Error {
		code: string;
		constructor(message?: string, _options?: ErrorOptions) {
			super(message);
			this.code = "";
			this.name = "FirebaseAuthError";
		}
	},
}));

import { AuthError } from "./auth-error";
import { FirebaseAuthError } from "@repo/firebase-auth-rest/auth";

function createFirebaseAuthError(code: string, message: string): FirebaseAuthError {
	const error = new FirebaseAuthError(message);
	(error as unknown as { code: string }).code = code;
	return error;
}

describe("AuthError", () => {
	describe("constructor defaults", () => {
		it("defaults to statusCode 401 and clearCookie false", () => {
			const error = new AuthError({ message: "Test", code: "test" });
			expect(error.statusCode).toBe(401);
			expect(error.clearCookie).toBe(false);
		});

		it("accepts custom statusCode and clearCookie", () => {
			const error = new AuthError({
				message: "Test",
				code: "test",
				statusCode: 403,
				clearCookie: true,
			});
			expect(error.statusCode).toBe(403);
			expect(error.clearCookie).toBe(true);
		});
	});

	describe("fromFirebase", () => {
		describe("clearCookie codes (session-related errors)", () => {
			const clearCookieCodes = [
				{ code: "auth/user-disabled", message: "Account is disabled.", statusCode: 403 },
				{ code: "auth/argument-error", message: "Invalid session.", statusCode: 401 },
				{ code: "auth/invalid-id-token", message: "Invalid session.", statusCode: 401 },
				{ code: "auth/session-cookie-expired", message: "Session expired.", statusCode: 401 },
				{ code: "auth/session-cookie-revoked", message: "Session revoked.", statusCode: 401 },
				{ code: "auth/user-not-found", message: "Invalid session.", statusCode: 401 },
			];

			for (const { code, message, statusCode } of clearCookieCodes) {
				it(`${code} → ${statusCode} + clearCookie`, () => {
					const result = AuthError.fromFirebase(
						createFirebaseAuthError(code, "ignored"),
						"Fallback",
					);
					expect(result.message).toBe(message);
					expect(result.statusCode).toBe(statusCode);
					expect(result.clearCookie).toBe(true);
					expect(result.code).toBe(code);
				});
			}
		});

		describe("non-clearCookie codes", () => {
			it("auth/internal-error → 503 without clearCookie", () => {
				const result = AuthError.fromFirebase(
					createFirebaseAuthError("auth/internal-error", "ignored"),
					"Fallback",
				);
				expect(result.message).toBe("Authentication service unavailable.");
				expect(result.statusCode).toBe(503);
				expect(result.clearCookie).toBe(false);
			});

			it("auth/invalid-session-cookie-duration → 500 without clearCookie", () => {
				const result = AuthError.fromFirebase(
					createFirebaseAuthError("auth/invalid-session-cookie-duration", "ignored"),
					"Fallback",
				);
				expect(result.message).toBe("Invalid session.");
				expect(result.statusCode).toBe(500);
				expect(result.clearCookie).toBe(false);
			});
		});

		describe("preserves original error as cause", () => {
			it("chains the original Firebase error", () => {
				const firebaseError = createFirebaseAuthError("auth/internal-error", "Internal");
				const result = AuthError.fromFirebase(firebaseError, "Fallback");
				expect(result.cause).toBe(firebaseError);
			});
		});

		describe("unknown codes and non-Firebase errors", () => {
			it("uses fallback for unknown Firebase code with default 401", () => {
				const result = AuthError.fromFirebase(
					createFirebaseAuthError("auth/unknown-code", "ignored"),
					"Something went wrong.",
				);
				expect(result.message).toBe("Something went wrong.");
				expect(result.statusCode).toBe(401);
				expect(result.clearCookie).toBe(false);
			});

			it("accepts custom fallback statusCode", () => {
				const result = AuthError.fromFirebase(
					createFirebaseAuthError("auth/unknown-code", "ignored"),
					"Service error.",
					502,
				);
				expect(result.statusCode).toBe(502);
			});

			it("returns unknown-error for plain Error", () => {
				const result = AuthError.fromFirebase(new Error("Not Firebase"), "Fallback");
				expect(result.code).toBe("unknown-error");
				expect(result.message).toBe("Fallback");
				expect(result.statusCode).toBe(401);
				expect(result.cause).toBeInstanceOf(Error);
			});
		});
	});
});
