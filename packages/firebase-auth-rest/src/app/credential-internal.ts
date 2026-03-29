/*!
 * @license
 * Copyright 2020 Google LLC
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
import crypto from "crypto";
import { Credential, GoogleOAuthAccessToken } from "./credential";
import { AppErrorCodes, FirebaseAppError } from "../utils/error";
import * as util from "../utils/validator";

/**
 * Firebase Admin SDK が使用するOAuth2スコープ。
 * 元のfirebase-admin-nodeと同じ5スコープ。
 */
const SCOPES = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/firebase.database",
	"https://www.googleapis.com/auth/firebase.messaging",
	"https://www.googleapis.com/auth/identitytoolkit",
	"https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/**
 * アクセストークンの更新を5分前に実行（元のgoogle-auth-libraryと同じ）
 */
const EAGER_REFRESH_THRESHOLD_MILLIS = 5 * 60 * 1000;

/**
 * Service Account を使用した Credential 実装。
 * google-auth-library / node-forge を jose + fetch に置き換え。
 */
export class ServiceAccountCredential implements Credential {
	public readonly projectId: string;
	public readonly privateKey: string;
	public readonly clientEmail: string;

	private cryptoKey: CryptoKey | undefined;

	// トークンキャッシュ
	private cachedToken: GoogleOAuthAccessToken | undefined;
	private cachedTokenExpireAt = 0;

	// 並行リクエスト重複排除
	private inFlightRequest: Promise<GoogleOAuthAccessToken> | undefined;

	/**
	 * Creates a new ServiceAccountCredential from the given parameters.
	 *
	 * @param serviceAccount - Service account json object.
	 *
	 * @constructor
	 */
	constructor(serviceAccount: object) {
		const sa = new ServiceAccount(serviceAccount);
		this.projectId = sa.projectId;
		this.privateKey = sa.privateKey;
		this.clientEmail = sa.clientEmail;
	}

	private async getCryptoKey(): Promise<CryptoKey> {
		if (this.cryptoKey) {
			return this.cryptoKey;
		}
		try {
			let pkcs8Pem = this.privateKey;
			// Firebase service account keys は PKCS#1 (BEGIN RSA PRIVATE KEY) の場合がある。
			// jose.importPKCS8 は PKCS#8 (BEGIN PRIVATE KEY) のみ受け付けるため、
			// PKCS#1 の場合は node:crypto の createPrivateKey で PKCS#8 に変換する。
			if (/-----BEGIN RSA PRIVATE KEY-----/.test(this.privateKey)) {
				const key = crypto.createPrivateKey({ key: this.privateKey, format: "pem" });
				pkcs8Pem = key.export({ format: "pem", type: "pkcs8" }) as string;
			}
			this.cryptoKey = await jose.importPKCS8(pkcs8Pem, "RS256");
			return this.cryptoKey;
		} catch (err: any) {
			throw new FirebaseAppError(
				AppErrorCodes.INVALID_CREDENTIAL,
				`Failed to parse the service account private key: ${err?.message || String(err)}`,
			);
		}
	}

	public async getAccessToken(): Promise<GoogleOAuthAccessToken> {
		// キャッシュが有効なら返す
		if (this.cachedToken && this.cachedTokenExpireAt > Date.now()) {
			return this.cachedToken;
		}

		// 既にリクエストが進行中ならそれを使い回す（重複排除）
		if (this.inFlightRequest) {
			return this.inFlightRequest;
		}

		this.inFlightRequest = this.fetchAccessToken();
		try {
			const token = await this.inFlightRequest;
			return token;
		} finally {
			this.inFlightRequest = undefined;
		}
	}

	private async fetchAccessToken(): Promise<GoogleOAuthAccessToken> {
		const cryptoKey = await this.getCryptoKey();

		// JWT Grant Assertion を作成（scope付き）
		const now = Math.floor(Date.now() / 1000);
		const assertion = await new jose.SignJWT({ scope: SCOPES })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(this.clientEmail)
			.setSubject(this.clientEmail)
			.setAudience("https://oauth2.googleapis.com/token")
			.setIssuedAt(now)
			.setExpirationTime(now + 3600)
			.sign(cryptoKey);

		// OAuth2 token endpoint にリクエスト
		const response = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new FirebaseAppError(
				AppErrorCodes.INVALID_CREDENTIAL,
				`Failed to obtain access token: ${response.status} ${errorText}`,
			);
		}

		const data = (await response.json()) as {
			access_token: string;
			expires_in: number;
			token_type: string;
		};

		if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
			throw new FirebaseAppError(
				AppErrorCodes.INVALID_CREDENTIAL,
				"Failed to parse Google auth credential: access_token must be a non-empty string.",
			);
		}

		const token: GoogleOAuthAccessToken = {
			access_token: data.access_token,
			expires_in: data.expires_in,
		};

		// キャッシュ: expires_in秒後 - 5分の猶予
		this.cachedToken = token;
		this.cachedTokenExpireAt = Date.now() + data.expires_in * 1000 - EAGER_REFRESH_THRESHOLD_MILLIS;

		return token;
	}
}

/**
 * Service account JSON オブジェクトをパース・検証
 */
class ServiceAccount {
	public readonly projectId: string;
	public readonly privateKey: string;
	public readonly clientEmail: string;

	constructor(json: object) {
		if (!util.isNonNullObject(json)) {
			throw new FirebaseAppError(
				AppErrorCodes.INVALID_CREDENTIAL,
				"Service account must be an object.",
			);
		}

		const tmp: any = {};
		copyAttr(tmp, json, "projectId", "project_id");
		copyAttr(tmp, json, "privateKey", "private_key");
		copyAttr(tmp, json, "clientEmail", "client_email");

		this.projectId = tmp.projectId;
		this.privateKey = tmp.privateKey;
		this.clientEmail = tmp.clientEmail;

		let errorMessage;
		if (!util.isNonEmptyString(this.projectId)) {
			errorMessage = 'Service account object must contain a string "project_id" property.';
		} else if (!util.isNonEmptyString(this.privateKey)) {
			errorMessage = 'Service account object must contain a string "private_key" property.';
		} else if (!util.isNonEmptyString(this.clientEmail)) {
			errorMessage = 'Service account object must contain a string "client_email" property.';
		}

		if (typeof errorMessage !== "undefined") {
			throw new FirebaseAppError(AppErrorCodes.INVALID_CREDENTIAL, errorMessage);
		}

		// PEMキー検証
		if (!this.privateKey.includes("-----BEGIN")) {
			throw new FirebaseAppError(
				AppErrorCodes.INVALID_CREDENTIAL,
				"Failed to parse private key: Invalid PEM format.",
			);
		}
	}
}

/**
 * Copies the specified property from one object to another.
 */
function copyAttr(
	to: { [key: string]: any },
	from: { [key: string]: any },
	key: string,
	alt: string,
): void {
	const tmp = from[key] || from[alt];
	if (typeof tmp !== "undefined") {
		to[key] = tmp;
	}
}
