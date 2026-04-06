/**
 * JWT テスト (decodeJwt, verifyJwtSignature, PublicKeySignatureVerifier, EmulatorSignatureVerifier)
 *
 * オリジナル: test/unit/utils/jwt.spec.ts
 * 適応: chai/sinon/nock → vitest (vi.fn, fetch mock), jose ベースのトークン生成,
 *       UrlKeyFetcher → X509CertFetcher (PEM 証明書フォーマット)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodeJwt,
  verifyJwtSignature,
  PublicKeySignatureVerifier,
  EmulatorSignatureVerifier,
  JwtErrorCode,
  JwtError,
} from "../utils/jwt";
import {
  generateIdToken,
  getPublicKeyPem,
  getMismatchPublicKeyPem,
  mockPrivateKeyKid,
  projectId,
  uid,
  ONE_HOUR_IN_SECONDS,
} from "./helpers/mocks";

// ---- テスト用定数 ----

const publicCertUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const TOKEN_PAYLOAD = {
  one: "uno",
  two: "dos",
  iat: 1,
  exp: ONE_HOUR_IN_SECONDS + 1,
  aud: projectId,
  iss: `https://securetoken.google.com/${projectId}`,
  sub: uid,
};

const DECODED_SIGNED_TOKEN = {
  header: {
    alg: "RS256",
    kid: mockPrivateKeyKid,
    typ: "JWT",
  },
  payload: TOKEN_PAYLOAD,
};

// ---- decodeJwt ----

describe("decodeJwt", () => {
  it("should throw given no token", () => {
    expect(() => (decodeJwt as any)()).toThrow("The provided token must be a string.");
  });

  const invalidIdTokens = [null, NaN, 0, 1, true, false, [], {}, { a: 1 }, () => {}];
  for (const invalidIdToken of invalidIdTokens) {
    it(`should throw given a non-string token: ${JSON.stringify(invalidIdToken)}`, () => {
      expect(() => decodeJwt(invalidIdToken as any)).toThrow(
        "The provided token must be a string.",
      );
    });
  }

  it("should throw given an empty string token", () => {
    expect(() => decodeJwt("")).toThrow("Decoding token failed.");
  });

  it("should throw given an invalid token", () => {
    expect(() => decodeJwt("invalid-token")).toThrow("Decoding token failed.");
  });

  it("should decode a valid signed token", async () => {
    vi.useFakeTimers({ now: 1000 });

    const mockIdToken = await generateIdToken();
    const decoded = decodeJwt(mockIdToken);

    expect(decoded.header).toMatchObject(DECODED_SIGNED_TOKEN.header);
    expect(decoded.payload).toMatchObject({
      one: "uno",
      two: "dos",
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: uid,
    });

    vi.useRealTimers();
  });

  it("should decode a valid unsigned (emulator) token", async () => {
    vi.useFakeTimers({ now: 1000 });

    const mockIdToken = await generateIdToken({ algorithm: "none" as any, header: {} });
    const decoded = decodeJwt(mockIdToken);

    expect(decoded.header.alg).toBe("none");
    expect(decoded.payload).toMatchObject({
      one: "uno",
      two: "dos",
    });

    vi.useRealTimers();
  });
});

// ---- verifyJwtSignature ----

describe("verifyJwtSignature", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject given no token", async () => {
    await expect((verifyJwtSignature as any)()).rejects.toThrow(
      "The provided token must be a string.",
    );
  });

  it("should be fulfilled given a valid signed token and public key", async () => {
    const mockIdToken = await generateIdToken();
    const publicKey = await getPublicKeyPem();
    await expect(verifyJwtSignature(mockIdToken, publicKey)).resolves.toBeUndefined();
  });

  it("should be rejected when the algorithm does not match", async () => {
    const mockIdToken = await generateIdToken();
    const publicKey = await getPublicKeyPem();
    await expect(
      verifyJwtSignature(mockIdToken, publicKey, { algorithms: ["RS384"] }),
    ).rejects.toThrow();
  });

  it("should be rejected given an expired token", async () => {
    vi.useFakeTimers({ now: 1000 });

    const mockIdToken = await generateIdToken();
    const publicKey = await getPublicKeyPem();

    // トークンはまだ有効
    await verifyJwtSignature(mockIdToken, publicKey);

    // 1時間経過
    vi.advanceTimersByTime(ONE_HOUR_IN_SECONDS * 1000);

    // トークンは期限切れ
    await expect(verifyJwtSignature(mockIdToken, publicKey)).rejects.toSatisfy(
      (err: JwtError) => err.code === JwtErrorCode.TOKEN_EXPIRED,
    );

    vi.useRealTimers();
  });

  it("should be rejected given a mismatched public key", async () => {
    const mockIdToken = await generateIdToken();
    const wrongPublicKey = await getMismatchPublicKeyPem();

    await expect(verifyJwtSignature(mockIdToken, wrongPublicKey)).rejects.toSatisfy(
      (err: JwtError) => err.code === JwtErrorCode.INVALID_SIGNATURE,
    );
  });

  it("should be rejected given an invalid JWT", async () => {
    const publicKey = await getPublicKeyPem();
    await expect(verifyJwtSignature("invalid-token", publicKey)).rejects.toSatisfy(
      (err: JwtError) => err.code === JwtErrorCode.INVALID_SIGNATURE,
    );
  });
});

// ---- PublicKeySignatureVerifier ----

describe("PublicKeySignatureVerifier", () => {
  describe("withCertificateUrl", () => {
    it("should return a PublicKeySignatureVerifier instance", () => {
      const verifier = PublicKeySignatureVerifier.withCertificateUrl(
        "https://www.example.com/publicKeys",
      );
      expect(verifier).toBeInstanceOf(PublicKeySignatureVerifier);
    });
  });

  describe("withJwksUrl", () => {
    it("should return a PublicKeySignatureVerifier instance", () => {
      const verifier = PublicKeySignatureVerifier.withJwksUrl("https://www.example.com/jwks");
      expect(verifier).toBeInstanceOf(PublicKeySignatureVerifier);
    });
  });

  describe("verify", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should reject given no token", async () => {
      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect((verifier.verify as any)()).rejects.toThrow(
        "The provided token must be a string.",
      );
    });

    it("should reject given an empty string token", async () => {
      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify("")).rejects.toThrow();
    });

    it("should be fulfilled given a valid token with matching public key from cert URL", async () => {
      const publicKeyPem = await getPublicKeyPem();
      const mockIdToken = await generateIdToken();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ [mockPrivateKeyKid]: publicKeyPem }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=3600",
          },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify(mockIdToken)).resolves.toBeUndefined();

      vi.restoreAllMocks();
    });

    it("should reject when no matching kid found", async () => {
      const mockIdToken = await generateIdToken();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ "not-a-matching-key": "some-public-key" }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify(mockIdToken)).rejects.toSatisfy(
        (err: JwtError) => err.code === JwtErrorCode.NO_MATCHING_KID,
      );

      vi.restoreAllMocks();
    });

    it("should reject when an error occurs while fetching keys", async () => {
      const mockIdToken = await generateIdToken();

      fetchSpy.mockRejectedValueOnce(new Error("Network error"));
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify(mockIdToken)).rejects.toSatisfy(
        (err: JwtError) => err.code === JwtErrorCode.KEY_FETCH_ERROR,
      );

      vi.restoreAllMocks();
    });

    it("should be fulfilled given a valid token without a kid (checks against all keys)", async () => {
      const publicKeyPem = await getPublicKeyPem();
      const mockIdToken = await generateIdToken({ header: {} });

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "kid-other": "some-other-key",
            [mockPrivateKeyKid]: publicKeyPem,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=3600",
            },
          },
        ),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify(mockIdToken)).resolves.toBeUndefined();

      vi.restoreAllMocks();
    });

    it("should reject given a token with an incorrect algorithm", async () => {
      const publicKeyPem = await getPublicKeyPem();
      // RS256 で署名したトークンのヘッダーを RS384 に書き換え (署名はRS256のままなので検証失敗する)
      const validToken = await generateIdToken();
      const parts = validToken.split(".");
      const headerObj = JSON.parse(atob(parts[0]!));
      headerObj.alg = "RS384";
      parts[0] = btoa(JSON.stringify(headerObj)).replace(/=/g, "");
      const mockIdToken = parts.join(".");

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ [mockPrivateKeyKid]: publicKeyPem }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);
      await expect(verifier.verify(mockIdToken)).rejects.toSatisfy(
        (err: JwtError) => err.code === JwtErrorCode.INVALID_SIGNATURE,
      );

      vi.restoreAllMocks();
    });

    it("should cache public keys and not re-fetch within TTL", async () => {
      const publicKeyPem = await getPublicKeyPem();
      const mockIdToken = await generateIdToken();

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ [mockPrivateKeyKid]: publicKeyPem }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const verifier = PublicKeySignatureVerifier.withCertificateUrl(publicCertUrl);

      // 1回目: fetch が呼ばれる
      await verifier.verify(mockIdToken);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // 2回目: キャッシュから返す
      await verifier.verify(mockIdToken);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });
});

// ---- EmulatorSignatureVerifier ----

describe("EmulatorSignatureVerifier", () => {
  it("should be fulfilled given a valid unsigned (emulator) token", async () => {
    const emulatorVerifier = new EmulatorSignatureVerifier();
    const mockIdToken = await generateIdToken({ algorithm: "none" as any, header: {} });
    await expect(emulatorVerifier.verify(mockIdToken)).resolves.toBeUndefined();
  });

  it("should reject given a valid signed (non-emulator) token", async () => {
    const emulatorVerifier = new EmulatorSignatureVerifier();
    const mockIdToken = await generateIdToken();
    await expect(emulatorVerifier.verify(mockIdToken)).rejects.toThrow();
  });
});
