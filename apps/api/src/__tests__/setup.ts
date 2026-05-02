import { vi, type Mock } from "vitest";

vi.mock("@repo/firebase-auth-rest/app", () => ({
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn((cred) => cred),
}));

vi.mock("../shared/middleware/csrf.middleware", () => ({
  csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
}));

const mockVerifySessionCookie: Mock = vi.fn();
const mockCreateSessionCookie: Mock = vi.fn();
const mockRevokeRefreshTokens: Mock = vi.fn();
const mockVerifyIdToken: Mock = vi.fn();

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

// firebase-admin.ts はトップレベルで env.FIREBASE_PRIVATE_KEY にアクセスするため、
// モジュール評価前に cloudflare:workers の env が未定義の場合がある。
// ここで firebase-admin 自体をモックし、安全なダミー関数をエクスポートする。
vi.mock("../shared/firebase/firebase-admin", () => ({
  createSessionCookie: mockCreateSessionCookie,
  verifySessionCookie: mockVerifySessionCookie,
  revokeRefreshTokens: mockRevokeRefreshTokens,
}));

const mockExchangeRefreshToken: Mock = vi.fn();

const mockGetRefreshTokenCookie: Mock = vi.fn().mockResolvedValue(null);
const mockSetRefreshTokenCookie: Mock = vi.fn().mockResolvedValue(undefined);
const mockClearRefreshTokenCookie: Mock = vi.fn();

vi.mock("../shared/firebase/firebase-token-exchange", () => ({
  exchangeRefreshToken: mockExchangeRefreshToken,
}));

vi.mock("../shared/auth/refresh-token", () => ({
  getRefreshTokenCookie: mockGetRefreshTokenCookie,
  setRefreshTokenCookie: mockSetRefreshTokenCookie,
  clearRefreshTokenCookie: mockClearRefreshTokenCookie,
}));

export {
  mockClearRefreshTokenCookie,
  mockCreateSessionCookie,
  mockExchangeRefreshToken,
  mockGetRefreshTokenCookie,
  mockRevokeRefreshTokens,
  mockSetRefreshTokenCookie,
  mockVerifyIdToken,
  mockVerifySessionCookie,
};
