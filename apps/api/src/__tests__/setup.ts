import { vi } from "vitest";

vi.mock("firebase-admin/app", () => ({
	initializeApp: vi.fn(() => ({})),
	cert: vi.fn((cred) => cred),
}));

const mockVerifySessionCookie = vi.fn();
const mockCreateSessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();
const mockVerifyIdToken = vi.fn();

vi.mock("@repo/firebase-auth-rest/auth", () => ({
	getAuth: vi.fn(() => ({
		verifySessionCookie: mockVerifySessionCookie,
		createSessionCookie: mockCreateSessionCookie,
		revokeRefreshTokens: mockRevokeRefreshTokens,
		verifyIdToken: mockVerifyIdToken,
	})),
	FirebaseAuthError: class extends Error {
		code: string;
		constructor(message?: string, _options?: ErrorOptions) {
			super(message);
			this.code = "";
			this.name = "FirebaseAuthError";
		}
	},
}));

export {
	mockCreateSessionCookie,
	mockRevokeRefreshTokens,
	mockVerifyIdToken,
	mockVerifySessionCookie,
};
