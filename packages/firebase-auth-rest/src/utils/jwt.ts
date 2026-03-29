/*!
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as jose from "jose";
import * as validator from "./validator";

export const ALGORITHM_RS256 = "RS256";

const NO_MATCHING_KID_ERROR_MESSAGE = "no-matching-kid-error";
const HOUR_IN_SECONDS = 3600;

export type Dictionary = { [key: string]: any };

export type DecodedToken = {
	header: Dictionary;
	payload: Dictionary;
};

export interface SignatureVerifier {
	verify(token: string): Promise<void>;
}

/**
 * Google証明書URLから X.509 PEM証明書を取得し、jose.importX509() でCryptoKeyに変換・キャッシュする。
 * Googleの証明書URLは {"kid": "-----BEGIN CERTIFICATE-----..."} 形式を返す(JWKSではない)。
 */
class X509CertFetcher {
	private cryptoKeys: Map<string, CryptoKey> = new Map();
	private expireAt = 0;

	constructor(private readonly certUrl: string) {
		if (!validator.isURL(certUrl)) {
			throw new Error("The provided client certificate URL is not a valid URL.");
		}
	}

	public async fetchPublicKey(kid: string): Promise<CryptoKey> {
		await this.ensureKeys();
		const key = this.cryptoKeys.get(kid);
		if (!key) {
			throw new JwtError(JwtErrorCode.NO_MATCHING_KID, NO_MATCHING_KID_ERROR_MESSAGE);
		}
		return key;
	}

	public async fetchAllPublicKeys(): Promise<Map<string, CryptoKey>> {
		await this.ensureKeys();
		return this.cryptoKeys;
	}

	private async ensureKeys(): Promise<void> {
		if (this.cryptoKeys.size > 0 && this.expireAt > Date.now()) {
			return;
		}
		await this.refresh();
	}

	private async refresh(): Promise<void> {
		let response: globalThis.Response;
		try {
			response = await fetch(this.certUrl);
		} catch (e: unknown) {
			throw new JwtError(
				JwtErrorCode.KEY_FETCH_ERROR,
				`Error fetching public keys for Google certs: ${(e as Error).message}`,
			);
		}

		if (!response.ok) {
			throw new JwtError(
				JwtErrorCode.KEY_FETCH_ERROR,
				`Error fetching public keys for Google certs: ${response.status} ${await response.text()}`,
			);
		}

		// Cache-Controlヘッダーからmax-ageを取得
		let maxAge = 6 * HOUR_IN_SECONDS; // デフォルト6時間
		const cacheControl = response.headers.get("cache-control");
		if (cacheControl) {
			for (const part of cacheControl.split(",")) {
				const trimmed = part.trim();
				if (trimmed.startsWith("max-age=")) {
					const parsed = parseInt(trimmed.split("=")[1]!, 10);
					if (!isNaN(parsed) && parsed > 0) {
						maxAge = parsed;
					}
				}
			}
		}

		let json: Record<string, string>;
		try {
			json = await response.json();
		} catch (e: unknown) {
			throw new JwtError(
				JwtErrorCode.KEY_FETCH_ERROR,
				`Error parsing public keys response: ${(e as Error).message}`,
			);
		}

		if (typeof json !== "object" || json === null || Array.isArray(json)) {
			throw new JwtError(
				JwtErrorCode.KEY_FETCH_ERROR,
				"Error parsing public keys response: Expected a JSON object.",
			);
		}

		const newKeys = new Map<string, CryptoKey>();

		for (const [kid, pem] of Object.entries(json)) {
			try {
				// X.509証明書 (BEGIN CERTIFICATE) を試す
				const cryptoKey = await jose.importX509(pem, ALGORITHM_RS256);
				newKeys.set(kid, cryptoKey);
			} catch {
				// X.509として失敗した場合、SPKI公開鍵PEMとして試す
				try {
					const cryptoKey = await jose.importSPKI(pem, ALGORITHM_RS256);
					newKeys.set(kid, cryptoKey);
				} catch {
					// どちらでもインポート失敗した場合はスキップ
				}
			}
		}

		this.cryptoKeys = newKeys;
		this.expireAt = Date.now() + maxAge * 1000;
	}
}

/**
 * jose-based 公開鍵署名検証。
 * Google証明書URL (X.509 PEM形式) と JWKS URL の両方に対応。
 */
export class PublicKeySignatureVerifier implements SignatureVerifier {
	private certFetcher: X509CertFetcher | undefined;
	private jwksUrl: string | undefined;
	private jwks: ReturnType<typeof jose.createRemoteJWKSet> | undefined;

	private constructor() {}

	/**
	 * Google証明書URL (X.509 PEM形式: {"kid": "-----BEGIN CERTIFICATE-----..."}) から検証。
	 */
	public static withCertificateUrl(clientCertUrl: string): PublicKeySignatureVerifier {
		const instance = new PublicKeySignatureVerifier();
		instance.certFetcher = new X509CertFetcher(clientCertUrl);
		return instance;
	}

	/**
	 * JWKS URL ({"keys": [{"kty":"RSA",...}]}) から検証。
	 */
	public static withJwksUrl(jwksUrl: string): PublicKeySignatureVerifier {
		const instance = new PublicKeySignatureVerifier();
		instance.jwksUrl = jwksUrl;
		instance.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
		return instance;
	}

	public async verify(token: string): Promise<void> {
		if (!validator.isString(token)) {
			throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "The provided token must be a string.");
		}

		// JWKS URLの場合 → jose.createRemoteJWKSetを使用
		if (this.jwksUrl) {
			return this.verifyWithJwks(token);
		}

		// X.509証明書URLの場合
		return this.verifyWithCerts(token);
	}

	private async verifyWithJwks(token: string): Promise<void> {
		try {
			await jose.jwtVerify(token, this.jwks!, { algorithms: [ALGORITHM_RS256] });
		} catch (error: any) {
			throw this.handleJoseError(error);
		}
	}

	private async verifyWithCerts(token: string): Promise<void> {
		const decoded = decodeJwt(token);
		const kid = decoded.header.kid as string | undefined;

		if (!kid) {
			// kid がない場合: 全鍵でフォールバック検証
			return this.verifyWithoutKid(token);
		}

		try {
			const cryptoKey = await this.certFetcher!.fetchPublicKey(kid);
			await jose.jwtVerify(token, cryptoKey, { algorithms: [ALGORITHM_RS256] });
		} catch (error: any) {
			if (error instanceof JwtError) {
				throw error;
			}
			throw this.handleJoseError(error);
		}
	}

	/**
	 * kidなしJWTのフォールバック: 全公開鍵で署名検証を試行。
	 * TOKEN_EXPIRED は即座にスローし、それ以外は失敗とみなす。
	 */
	private async verifyWithoutKid(token: string): Promise<void> {
		const allKeys = await this.certFetcher!.fetchAllPublicKeys();
		const promises: Promise<boolean>[] = [];

		for (const cryptoKey of allKeys.values()) {
			promises.push(
				jose
					.jwtVerify(token, cryptoKey, { algorithms: [ALGORITHM_RS256] })
					.then(() => true)
					.catch((error: any) => {
						if (error?.code === "ERR_JWT_EXPIRED") {
							throw new JwtError(
								JwtErrorCode.TOKEN_EXPIRED,
								"The provided token has expired. Get a fresh token from your client app and try again.",
							);
						}
						return false;
					}),
			);
		}

		const results = await Promise.all(promises);
		if (results.every((r) => r === false)) {
			throw new JwtError(JwtErrorCode.INVALID_SIGNATURE, "Invalid token signature.");
		}
	}

	private handleJoseError(error: any): JwtError {
		if (error?.code === "ERR_JWT_EXPIRED") {
			return new JwtError(
				JwtErrorCode.TOKEN_EXPIRED,
				"The provided token has expired. Get a fresh token from your client app and try again.",
			);
		}
		if (error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
			return new JwtError(JwtErrorCode.NO_MATCHING_KID, NO_MATCHING_KID_ERROR_MESSAGE);
		}
		if (error?.code === "ERR_JWT_INVALID") {
			return new JwtError(JwtErrorCode.INVALID_SIGNATURE, error.message || "Invalid token.");
		}
		return new JwtError(
			JwtErrorCode.INVALID_SIGNATURE,
			error?.message || "Token verification failed.",
		);
	}
}

/**
 * エミュレーター用: alg:none のトークンのみ受け入れる。
 */
export class EmulatorSignatureVerifier implements SignatureVerifier {
	public async verify(token: string): Promise<void> {
		if (!validator.isString(token)) {
			throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "The provided token must be a string.");
		}

		// デコードしてalgを確認
		const decoded = decodeJwt(token);
		if (decoded.header.alg !== "none") {
			throw new JwtError(
				JwtErrorCode.INVALID_SIGNATURE,
				'Emulator tokens must have "alg: none". Use verifyIdToken() with a real token instead.',
			);
		}
	}
}

/**
 * JWT署名を検証（PEM鍵使用）
 */
export async function verifyJwtSignature(
	token: string,
	secretOrPublicKey: string,
	options?: { algorithms?: string[] },
): Promise<void> {
	if (!validator.isString(token)) {
		throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "The provided token must be a string.");
	}

	try {
		const key = await jose.importSPKI(secretOrPublicKey, ALGORITHM_RS256);
		await jose.jwtVerify(token, key, { algorithms: options?.algorithms || [ALGORITHM_RS256] });
	} catch (error: any) {
		if (error instanceof JwtError) {
			throw error;
		}
		if (error?.code === "ERR_JWT_EXPIRED") {
			throw new JwtError(
				JwtErrorCode.TOKEN_EXPIRED,
				"The provided token has expired. Get a fresh token from your client app and try again.",
			);
		}
		if (error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
			throw new JwtError(JwtErrorCode.NO_MATCHING_KID, NO_MATCHING_KID_ERROR_MESSAGE);
		}
		throw new JwtError(
			JwtErrorCode.INVALID_SIGNATURE,
			error?.message || "Token verification failed.",
		);
	}
}

/**
 * JWT をデコード（署名検証なし）
 */
export function decodeJwt(jwtToken: string): DecodedToken {
	if (!validator.isString(jwtToken)) {
		throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "The provided token must be a string.");
	}

	try {
		const header = jose.decodeProtectedHeader(jwtToken) as Dictionary;
		const payload = jose.decodeJwt(jwtToken) as Dictionary;

		if (!header || !payload) {
			throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "Decoding token failed.");
		}

		return { header, payload };
	} catch (e: unknown) {
		if (e instanceof JwtError) {
			throw e;
		}
		throw new JwtError(JwtErrorCode.INVALID_ARGUMENT, "Decoding token failed.");
	}
}

export class JwtError extends Error {
	constructor(
		readonly code: JwtErrorCode,
		readonly message: string,
	) {
		super(message);
		Object.setPrototypeOf(this, JwtError.prototype);
	}
}

export enum JwtErrorCode {
	INVALID_ARGUMENT = "invalid-argument",
	TOKEN_EXPIRED = "token-expired",
	INVALID_SIGNATURE = "invalid-token",
	NO_MATCHING_KID = "no-matching-kid-error",
	KEY_FETCH_ERROR = "key-fetch-error",
}
