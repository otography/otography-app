/*!
 * firebase-admin-rest
 *
 * Cloudflare Workers-compatible drop-in replacement for firebase-admin (app + auth).
 * Uses jose + fetch instead of jsonwebtoken, jwks-rsa, google-auth-library, node-forge.
 */

export { initializeApp, getApp, getApps, deleteApp, cert, FirebaseApp } from "./app";

export type {
  App,
  AppOptions,
  FirebaseError,
  FirebaseArrayIndexError,
  Credential,
  ServiceAccount,
} from "./app";

export { getAuth, Auth, FirebaseAuthError } from "./auth";

export type {
  DecodedIdToken,
  DecodedAuthBlockingToken,
  DeleteUsersResult,
  GetUsersResult,
  ListUsersResult,
  SessionCookieOptions,
  UserRecord,
  CreateRequest,
  UpdateRequest,
  EmailIdentifier,
  PhoneIdentifier,
  ProviderIdentifier,
  UidIdentifier,
  UserIdentifier,
  CreateTenantRequest,
  Tenant,
  UpdateTenantRequest,
  ListTenantsResult,
  TenantAwareAuth,
  TenantManager,
  UpdateProjectConfigRequest,
  ProjectConfig,
  ProjectConfigManager,
  UserImportOptions,
  UserImportRecord,
  UserImportResult,
  MultiFactorInfo,
  MultiFactorSettings,
  PhoneMultiFactorInfo,
  UserInfo,
  UserMetadata,
} from "./auth";
