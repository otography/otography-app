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

import { Credential, ServiceAccount } from "./credential";
import { ServiceAccountCredential } from "./credential-internal";

const globalCertCreds: { [key: string]: ServiceAccountCredential } = {};

/**
 * Returns a credential created from the provided service account that grants
 * admin access to Firebase services. This credential can be used in the call
 * to {@link firebase-admin.app#initializeApp}.
 *
 * @param serviceAccountPathOrObject - An object representing a service account key.
 *
 * @returns A credential authenticated via the
 *   provided service account that can be used to initialize an app.
 */
export function cert(serviceAccountPathOrObject: string | ServiceAccount): Credential {
	const stringifiedServiceAccount = JSON.stringify(serviceAccountPathOrObject);
	if (!(stringifiedServiceAccount in globalCertCreds)) {
		globalCertCreds[stringifiedServiceAccount] = new ServiceAccountCredential(
			serviceAccountPathOrObject,
		);
	}
	return globalCertCreds[stringifiedServiceAccount]!;
}
