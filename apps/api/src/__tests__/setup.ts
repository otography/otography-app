import { vi, type Mock } from "vitest";

vi.mock("@repo/firebase-auth-rest/app", () => ({
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn((cred) => cred),
}));

vi.mock("../shared/middleware/csrf.middleware", () => ({
  csrfProtection: () => async (_c: unknown, next: () => Promise<void>) => await next(),
}));

const mockVerifySessionCookie: Mock = vi.fn();
const mockVerifySessionCookieStrict: Mock = vi.fn();
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
  // FirebaseAuthError のモック — 本物のコンストラクタは ErrorInfo({code, message}) を受け取る。
  // code プレフィックス "auth/" を再現し、fromFirebase() の code マッピングをテスト可能にする。
  FirebaseAuthError: class extends Error {
    code: string;
    constructor(info: { code: string; message: string } | string, _options?: ErrorOptions) {
      super(typeof info === "object" ? info.message : (info ?? ""));
      this.code = typeof info === "object" ? `auth/${info.code}` : "";
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
  verifySessionCookieStrict: mockVerifySessionCookieStrict,
  revokeRefreshTokens: mockRevokeRefreshTokens,
}));

const mockExchangeRefreshToken: Mock = vi.fn();

vi.mock("../shared/firebase/firebase-token-exchange", () => ({
  exchangeRefreshToken: mockExchangeRefreshToken,
}));

// キーリングローダーのモック
const mockGetEncryptCtx: Mock = vi.fn().mockResolvedValue({
  activeKeyId: "test-key-1",
  activeKey: {},
  keys: new Map([["test-key-1", { id: "test-key-1", cryptoKey: {}, decryptOnly: false }]]),
});

vi.mock("../shared/auth/key-ring-loader", () => ({
  getEncryptCtx: mockGetEncryptCtx,
}));

// エンベロープ暗号化のモック
const mockEncryptCredential: Mock = vi.fn(async (_ctx: unknown, plaintext: string) => ({
  v: 1,
  kid: "test-key-1",
  iv: "00".repeat(12),
  ct: `encrypted-${plaintext}`,
}));

const mockDecryptCredential: Mock = vi.fn(async (_ctx: unknown, envelope: { ct: string }) => {
  // ct が "encrypted-XYZ" の形式なら "XYZ" を返す
  if (envelope.ct.startsWith("encrypted-")) {
    return envelope.ct.slice("encrypted-".length);
  }
  return envelope.ct;
});

vi.mock("../shared/auth/envelope", () => ({
  encryptCredential: mockEncryptCredential,
  decryptCredential: mockDecryptCredential,
  EnvelopeError: class EnvelopeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EnvelopeError";
    }
  },
}));

// セッションサービスのモック
const mockIssueSession: Mock = vi.fn();
const mockResolveSession: Mock = vi.fn().mockResolvedValue(null);

vi.mock("../shared/auth/session-service", () => ({
  issueSession: mockIssueSession,
  resolveSession: mockResolveSession,
  batchReEncrypt: vi.fn().mockResolvedValue({ reEncrypted: 0, errors: [] }),
  countRemainingByKey: vi.fn().mockResolvedValue(0),
}));

export {
  mockCreateSessionCookie,
  mockDecryptCredential,
  mockEncryptCredential,
  mockExchangeRefreshToken,
  mockGetEncryptCtx,
  mockIssueSession,
  mockResolveSession,
  mockRevokeRefreshTokens,
  mockVerifyIdToken,
  mockVerifySessionCookie,
  mockVerifySessionCookieStrict,
};
