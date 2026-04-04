import { vi } from "vitest";

// Set env vars BEFORE any module that calls getBootEnv()
process.env.FIREBASE_API_KEY = "test-api-key" as never;
process.env.FIREBASE_CLIENT_EMAIL = "test@example.com";
process.env.FIREBASE_PRIVATE_KEY =
	"-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----";
process.env.FIREBASE_PROJECT_ID = "test-project" as never;
process.env.APP_FRONTEND_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

vi.mock("cloudflare:workers", () => ({
	env: {
		FIREBASE_CLIENT_EMAIL: "test@example.com",
		FIREBASE_PRIVATE_KEY:
			"-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----",
		FIREBASE_PROJECT_ID: "test-project",
	},
}));

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
