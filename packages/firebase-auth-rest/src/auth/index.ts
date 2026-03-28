/*!
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

/**
 * Firebase Authentication.
 *
 * @packageDocumentation
 */

import { App, getApp } from "../app/index";
import { FirebaseApp } from "../app/firebase-app";
import { Auth } from "./auth";

/**
 * Gets the {@link Auth} service for the default app or a
 * given app.
 */
export function getAuth(app?: App): Auth {
	if (typeof app === "undefined") {
		app = getApp();
	}

	const firebaseApp: FirebaseApp = app as FirebaseApp;
	return firebaseApp.getOrInitService("auth", (app) => new Auth(app));
}

export type { ActionCodeSettings } from "./action-code-settings-builder";

export { Auth } from "./auth";

export type {
	AllowByDefault,
	AllowByDefaultWrap,
	AllowlistOnly,
	AllowlistOnlyWrap,
	AuthFactorType,
	AuthProviderConfig,
	AuthProviderConfigFilter,
	BaseAuthProviderConfig,
	BaseCreateMultiFactorInfoRequest,
	BaseUpdateMultiFactorInfoRequest,
	CreateMultiFactorInfoRequest,
	CreatePhoneMultiFactorInfoRequest,
	CreateRequest,
	EmailSignInProviderConfig,
	ListProviderConfigResults,
	MultiFactorConfig,
	MultiFactorConfigState,
	MultiFactorCreateSettings,
	MultiFactorUpdateSettings,
	MultiFactorProviderConfig,
	OAuthResponseType,
	OIDCAuthProviderConfig,
	OIDCUpdateAuthProviderRequest,
	RecaptchaAction,
	RecaptchaConfig,
	RecaptchaKey,
	RecaptchaKeyClientType,
	RecaptchaManagedRule,
	RecaptchaTollFraudManagedRule,
	RecaptchaProviderEnforcementState,
	SAMLAuthProviderConfig,
	SAMLUpdateAuthProviderRequest,
	SmsRegionConfig,
	UserProvider,
	UpdateAuthProviderRequest,
	UpdateMultiFactorInfoRequest,
	UpdatePhoneMultiFactorInfoRequest,
	UpdateRequest,
	TotpMultiFactorProviderConfig,
	PasswordPolicyConfig,
	PasswordPolicyEnforcementState,
	CustomStrengthOptionsConfig,
	EmailPrivacyConfig,
	MobileLinksConfig,
	MobileLinksDomain,
} from "./auth-config";

export { BaseAuth } from "./base-auth";

export type {
	DeleteUsersResult,
	GetUsersResult,
	ListUsersResult,
	SessionCookieOptions,
} from "./base-auth";

export type {
	EmailIdentifier,
	PhoneIdentifier,
	ProviderIdentifier,
	UidIdentifier,
	UserIdentifier,
} from "./identifier";

export type { CreateTenantRequest, Tenant, UpdateTenantRequest } from "./tenant";

export { TenantAwareAuth, TenantManager } from "./tenant-manager";

export type { ListTenantsResult } from "./tenant-manager";

export type { UpdateProjectConfigRequest, ProjectConfig } from "./project-config";

export { ProjectConfigManager } from "./project-config-manager";

export type { DecodedIdToken, DecodedAuthBlockingToken } from "./token-verifier";

export type {
	HashAlgorithmType,
	UserImportOptions,
	UserImportRecord,
	UserImportResult,
	UserMetadataRequest,
	UserProviderRequest,
} from "./user-import-builder";

export type {
	MultiFactorInfo,
	MultiFactorSettings,
	PhoneMultiFactorInfo,
	UserInfo,
	UserMetadata,
} from "./user-record";

export { UserRecord } from "./user-record";

export { FirebaseAuthError, AuthClientErrorCode } from "../utils/error";
