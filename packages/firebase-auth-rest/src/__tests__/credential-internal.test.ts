/**
 * ServiceAccountCredential テスト
 *
 * オリジナル: test/unit/app/credential-internal.spec.ts
 * 適応: chai/sinon → vitest, RefreshTokenCredential/ApplicationDefaultCredential を除外
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceAccountCredential } from "../app/credential-internal";
import { mockPrivateKeyPem } from "./helpers/mocks";

// mock.key.json と同じ内容
const mockCertificateObject = {
	type: "service_account",
	project_id: "project_id",
	private_key_id: "aaaaaaaaaabbbbbbbbbbccccccccccdddddddddd",
	private_key: mockPrivateKeyPem,
	client_email: "foo@project_id.iam.gserviceaccount.com",
};

describe("ServiceAccountCredential", () => {
	let mockCert: typeof mockCertificateObject;

	beforeEach(() => {
		mockCert = { ...mockCertificateObject };
	});

	// ---- コンストラクタ: 無効な引数 ----

	describe("constructor", () => {
		const invalidFilePaths = [null, NaN, 0, 1, true, false, undefined, () => {}];
		for (const invalidFilePath of invalidFilePaths) {
			it(`should throw if called with non-string, non-object argument: ${JSON.stringify(invalidFilePath)}`, () => {
				expect(() => new ServiceAccountCredential(invalidFilePath as any)).toThrow(
					"Service account must be an object",
				);
			});
		}

		it("should throw given an object without a 'project_id' property", () => {
			const invalid = { ...mockCert };
			delete (invalid as any).project_id;
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				'Service account object must contain a string "project_id" property',
			);
		});

		it("should throw given an object without a 'private_key' property", () => {
			const invalid = { ...mockCert };
			delete (invalid as any).private_key;
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				'Service account object must contain a string "private_key" property',
			);
		});

		it("should throw given an object with an empty string 'private_key' property", () => {
			const invalid = { ...mockCert, private_key: "" };
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				'Service account object must contain a string "private_key" property',
			);
		});

		it("should throw given an object without a 'client_email' property", () => {
			const invalid = { ...mockCert };
			delete (invalid as any).client_email;
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				'Service account object must contain a string "client_email" property',
			);
		});

		it("should throw given an object with an empty string 'client_email' property", () => {
			const invalid = { ...mockCert, client_email: "" };
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				'Service account object must contain a string "client_email" property',
			);
		});

		it("should throw given an object with a malformed 'private_key' property", () => {
			const invalid = { ...mockCert, private_key: "malformed" };
			expect(() => new ServiceAccountCredential(invalid as any)).toThrow(
				"Failed to parse private key",
			);
		});

		// ---- 有効なケース ----

		it("should not throw given a valid certificate object", () => {
			expect(() => new ServiceAccountCredential(mockCert)).not.toThrow();
		});

		it("should accept 'clientEmail' in place of 'client_email'", () => {
			const cert = { ...mockCert, clientEmail: mockCert.client_email };
			delete (cert as any).client_email;
			expect(() => new ServiceAccountCredential(cert)).not.toThrow();
		});

		it("should accept 'privateKey' in place of 'private_key'", () => {
			const cert = { ...mockCert, privateKey: mockCert.private_key };
			delete (cert as any).private_key;
			expect(() => new ServiceAccountCredential(cert)).not.toThrow();
		});

		it("should expose projectId, clientEmail, privateKey", () => {
			const cred = new ServiceAccountCredential(mockCert);
			expect(cred.projectId).toBe(mockCert.project_id);
			expect(cred.clientEmail).toBe(mockCert.client_email);
			expect(cred.privateKey).toBe(mockCert.private_key);
		});
	});

	// ---- getAccessToken ----

	describe("getAccessToken", () => {
		it("should fetch an access token from Google OAuth2 token endpoint", async () => {
			const mockTokenResponse = {
				access_token: "mock-access-token-123",
				expires_in: 3600,
				token_type: "Bearer",
			};

			const mockFetch = vi.fn().mockResolvedValue(
				new Response(JSON.stringify(mockTokenResponse), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
			vi.stubGlobal("fetch", mockFetch);

			const cred = new ServiceAccountCredential(mockCert);
			const token = await cred.getAccessToken();

			expect(token.access_token).toBe("mock-access-token-123");
			expect(token.expires_in).toBe(3600);
			expect(mockFetch).toHaveBeenCalledOnce();

			// トークンエンドポイントが正しいことを確認
			const fetchUrl = mockFetch.mock.calls[0]![0] as string;
			expect(fetchUrl).toBe("https://oauth2.googleapis.com/token");

			vi.restoreAllMocks();
		});

		it("should cache the token and not re-fetch within the cache period", async () => {
			const mockTokenResponse = {
				access_token: "cached-token",
				expires_in: 3600,
				token_type: "Bearer",
			};

			const mockFetch = vi.fn().mockResolvedValue(
				new Response(JSON.stringify(mockTokenResponse), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
			vi.stubGlobal("fetch", mockFetch);

			const cred = new ServiceAccountCredential(mockCert);

			// 1回目
			const token1 = await cred.getAccessToken();
			// 2回目 (キャッシュから返す)
			const token2 = await cred.getAccessToken();

			expect(token1.access_token).toBe("cached-token");
			expect(token2.access_token).toBe("cached-token");
			expect(mockFetch).toHaveBeenCalledOnce();

			vi.restoreAllMocks();
		});

		it("should throw on non-200 response from token endpoint", async () => {
			const mockFetch = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "invalid_grant" }), {
					status: 400,
					headers: { "content-type": "application/json" },
				}),
			);
			vi.stubGlobal("fetch", mockFetch);

			const cred = new ServiceAccountCredential(mockCert);
			await expect(cred.getAccessToken()).rejects.toThrow();

			vi.restoreAllMocks();
		});

		it("should deduplicate concurrent token requests", async () => {
			let resolveResponse: (r: Response) => void;
			const responsePromise = new Promise<Response>((resolve) => {
				resolveResponse = resolve;
			});

			const mockFetch = vi.fn().mockReturnValue(responsePromise);
			vi.stubGlobal("fetch", mockFetch);

			const cred = new ServiceAccountCredential(mockCert);

			// 同時に3つリクエスト
			const p1 = cred.getAccessToken();
			const p2 = cred.getAccessToken();
			const p3 = cred.getAccessToken();

			// 1つのfetch呼び出しで解決
			resolveResponse!(
				new Response(JSON.stringify({ access_token: "deduped-token", expires_in: 3600 }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);

			const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
			expect(t1.access_token).toBe("deduped-token");
			expect(t2.access_token).toBe("deduped-token");
			expect(t3.access_token).toBe("deduped-token");
			// 1回だけfetchが呼ばれる
			expect(mockFetch).toHaveBeenCalledOnce();

			vi.restoreAllMocks();
		});
	});
});
