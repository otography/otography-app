/*!
 * @license
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

import crypto from "crypto";
import { App } from "../app";
import { ServiceAccountCredential } from "../app/credential-internal";
import { ErrorInfo } from "../utils/error";

const ALGORITHM_RS256 = "RS256" as const;

/**
 * CryptoSigner interface represents an object that can be used to sign JWTs.
 */
export interface CryptoSigner {
	/**
	 * The name of the signing algorithm.
	 */
	readonly algorithm: string;

	/**
	 * Cryptographically signs a buffer of data.
	 *
	 * @param buffer - The data to be signed.
	 * @returns A promise that resolves with the raw bytes of a signature.
	 */
	sign(buffer: Buffer): Promise<Buffer>;

	/**
	 * Returns the ID of the service account used to sign tokens.
	 *
	 * @returns A promise that resolves with a service account ID.
	 */
	getAccountId(): Promise<string>;
}

/**
 * A CryptoSigner implementation that uses an explicitly specified service account private key to
 * sign data. Performs all operations locally, and does not make any RPC calls.
 */
class ServiceAccountSigner implements CryptoSigner {
	algorithm = ALGORITHM_RS256;

	/**
	 * Creates a new CryptoSigner instance from the given service account credential.
	 *
	 * @param credential - A service account credential.
	 */
	constructor(private readonly credential: ServiceAccountCredential) {
		if (!credential) {
			throw new CryptoSignerError({
				code: CryptoSignerErrorCode.INVALID_CREDENTIAL,
				message:
					"INTERNAL ASSERT: Must provide a service account credential to initialize ServiceAccountSigner.",
			});
		}
	}

	/**
	 * @inheritDoc
	 */
	public sign(buffer: Buffer): Promise<Buffer> {
		const sign = crypto.createSign("RSA-SHA256");
		sign.update(buffer);
		return Promise.resolve(sign.sign(this.credential.privateKey));
	}

	/**
	 * @inheritDoc
	 */
	public getAccountId(): Promise<string> {
		return Promise.resolve(this.credential.clientEmail);
	}
}

/**
 * Creates a new CryptoSigner instance for the given app.
 *
 * @param app - A FirebaseApp instance.
 * @returns A CryptoSigner instance.
 */
export function cryptoSignerFromApp(app: App): CryptoSigner {
	const credential = app.options.credential;
	if (credential instanceof ServiceAccountCredential) {
		return new ServiceAccountSigner(credential);
	}

	throw new CryptoSignerError({
		code: CryptoSignerErrorCode.INVALID_CREDENTIAL,
		message: "Must initialize the SDK with a service account credential.",
	});
}

/**
 * Defines extended error info type. This includes a code, message string, and error data.
 */
interface ExtendedErrorInfo extends ErrorInfo {
	cause?: Error;
}

/**
 * CryptoSigner error code structure.
 *
 * @param errorInfo - The error information (code and message).
 * @constructor
 */
export class CryptoSignerError extends Error {
	constructor(private errorInfo: ExtendedErrorInfo) {
		super(errorInfo.message);

		/* tslint:disable:max-line-length */
		// Set the prototype explicitly. See the following link for more details:
		// https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
		/* tslint:enable:max-line-length */
		(this as any).__proto__ = CryptoSignerError.prototype;
	}

	/** @returns The error code. */
	public get code(): string {
		return this.errorInfo.code;
	}

	/** @returns The error message. */
	public get message(): string {
		return this.errorInfo.message;
	}

	/** @returns The error data. */
	public get cause(): Error | undefined {
		return this.errorInfo.cause;
	}
}

/**
 * Crypto Signer error codes and their default messages.
 */
export class CryptoSignerErrorCode {
	public static INVALID_ARGUMENT = "invalid-argument";
	public static INTERNAL_ERROR = "internal-error";
	public static INVALID_CREDENTIAL = "invalid-credential";
	public static SERVER_ERROR = "server-error";
}
