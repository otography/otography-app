# firebase-admin-rest の完全実装

## Context

`firebase-admin-rest`は`firebase-admin-node`のREST版ドロップインリプレイスメント。現在は`createSessionCookie`, `verifySessionCookie`, `revokeRefreshTokens`の3メソッドのみ動作する。元実装と比較した結果、約7,000行のコードが欠落しているため、一ファイルずつ元実装と同じように完全実装する。

## 実装方針

- Node.js依存（`crypto`, `http`, `https`, `fs`, `google-auth-library`, `jsonwebtoken`, `jwks-rsa`）→`fetch`+`jose`に置換
- `Buffer`→`Uint8Array`/`ArrayBuffer`に置換
- `ApplicationDefaultCredential`, `RefreshTokenCredential`, `ImpersonatedServiceAccountCredential`は`google-auth-library`に依存するため、REST APIで等価な機能を実装
- HTTP/2サポートは除外（fetchベース）
- エミュレータサポートは`useEmulator()`スタブのまま（環境変数は読むように修正）

## 依存関係順の実装フェーズ

### Phase 1: utils/ (基盤層)

実装順（依存関係の葉から順に）:

| #   | ファイル                 | 元行数 | 欠落行数 | 内容                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `utils/validator.ts`     | 300    | ~215     | `isBoolean`, `isBase64String`, `isUTCDateString`, `isTopic`, `isTaskId` 追加。`isURL` をhttp/httpsスキーマ検証に強化。`isISODateString` をISOString厳密チェックに修正。`isPhoneNumber` を元のlax版に戻す。`isNonNullObject` の配列除外を修正。                                                                                                                                                                           |
| 2   | `utils/error.ts`         | 1148   | ~617     | 46個の欠損`AuthClientErrorCode`追加。7個のエラークラス（Database, Firestore, InstanceId, Installations, Messaging, MessagingSession, ProjectManagement）追加。`MessagingClientErrorCode`, `InstallationsClientErrorCode`, `InstanceIdClientErrorCode`, `ProjectManagementErrorCode` 追加。`MESSAGING_SERVER_TO_CLIENT_CODE`, `TOPIC_MGT_SERVER_TO_CLIENT_CODE` 追加。8個の欠損`AUTH_SERVER_TO_CLIENT_CODE`エントリ追加。 |
| 3   | `utils/deep-copy.ts`     | 81     | 0        | 完了済み（変更不要）                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4   | `utils/index.ts`         | 308    | ~86      | `toWebSafeBase64`, `generateUpdateMask`, `transformMillisecondsToSecondsString`, `parseResourceName`, `ParsedResource` 追加。`getExplicitProjectId` に環境変数フォールバック追加。`findProjectId`, `findServiceAccountEmail` にADC/メタデータサービスフォールバック追加。                                                                                                                                                |
| 5   | `utils/api-request.ts`   | 1395   | ~300     | **リトライロジック**（`RetryConfig`, `defaultRetryConfig`, `validateRetryConfig`, `RequestClient`基底クラス）追加。`parseHttpResponse` 関数追加。`ExponentialBackoffPoller` 追加。multipart/HTTP2は除外。`AuthorizedHttpClient` にquota project IDヘッダー追加。                                                                                                                                                         |
| 6   | `utils/crypto-signer.ts` | 261    | ~114     | `CryptoSigner.sign()` メソッド追加。`IAMSigner` クラス追加（IAM `signBlob` REST API使用）。`ExtendedErrorInfo` インターフェース追加。`CryptoSignerError.cause` ゲッター追加。`CryptoSignerErrorCode.INTERNAL_ERROR` 追加。`cryptoSignerFromApp` にIAMSignerフォールバック追加。                                                                                                                                          |
| 7   | `utils/jwt.ts`           | 372    | ~106     | `JwksFetcher` クラス追加（`jwks-rsa`の代わりにfetch + jose）。`PublicKeySignatureVerifier.withJwksUrl()` 追加。`verifyJwtSignature` エクスポート関数追加。`KeyFetcher` インターフェース追加。`verifyWithoutKid` を`Promise.all`並列版に変更。`EmulatorSignatureVerifier` にJWT構造検証追加。                                                                                                                             |

### Phase 2: app/ (アプリケーション層)

| #   | ファイル                     | 元行数 | 欠落行数 | 内容                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | `app/credential.ts`          | 78     | 0        | 完了済み（変更不要）                                                                                                                                                                                                                                                                     |
| 9   | `app/credential-internal.ts` | 511    | ~332     | `ApplicationDefaultCredential` 追加（`google-auth-library`の代わりにメタデータサービスREST API使用）。`RefreshTokenCredential` + `RefreshToken` 追加。`ImpersonatedServiceAccountCredential` + `ImpersonatedServiceAccount` 追加。`isApplicationDefault`, `getApplicationDefault` 追加。 |
| 10  | `app/credential-factory.ts`  | 156    | ~117     | `applicationDefault()` 追加。`refreshToken()` 追加。`clearGlobalAppDefaultCred()` 追加。グローバルキャッシュ変数追加。                                                                                                                                                                   |
| 11  | `app/core.ts`                | 103    | 0        | 完了済み（`httpAgent`は意図的除外）                                                                                                                                                                                                                                                      |
| 12  | `app/firebase-app.ts`        | 264    | ~10      | ADC未対応時のエラー処理は意図的。`getApps()` のコメントのみ微修正。                                                                                                                                                                                                                      |
| 13  | `app/firebase-namespace.ts`  | 403    | ~323     | `credential` 名前空間に`cert`, `refreshToken`, `applicationDefault` 追加。`extendApp()` 追加（authのみ実装、他サービスはスタブ）。`__esModule`, `Promise` プロパティ追加。サービス名前空間ゲッター（authのみ実装）追加。                                                                 |
| 14  | `app/lifecycle.ts`           | 169    | ~5       | `JSON.stringify` → ソート付きキーの簡易deep equalに改善。                                                                                                                                                                                                                                |
| 15  | `app/index.ts`               | 51     | ~3       | `applicationDefault`, `refreshToken` のエクスポート追加。                                                                                                                                                                                                                                |

### Phase 3: auth/ (Auth機能層)

| #   | ファイル                               | 元行数 | 欠落行数 | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | `auth/auth-config.ts`                  | 2555   | ~2380    | **最大ファイル。** 全インターフェース・クラスを実装: `MultiFactorAuthConfig`, `EmailSignInConfig`, `SAMLConfig`, `OIDCConfig`（`buildServerRequest`, `validate`, `toJSON` 含む）。`SmsRegionsAuthConfig`, `RecaptchaAuthConfig`, `PasswordPolicyAuthConfig`, `EmailPrivacyAuthConfig`, `MobileLinksAuthConfig`。`validateTestPhoneNumbers()`。全関連型（`UserProvider`, `CreateRequest`, `UpdateRequest`, `AuthProviderConfig` 等）。                                                                                                                                                    |
| 17  | `auth/user-record.ts`                  | 675    | ~450     | `MultiFactorId` enum, `MultiFactorInfo` (abstract), `PhoneMultiFactorInfo`, `TotpMultiFactorInfo`, `TotpInfo`, `MultiFactorSettings`, `UserMetadata`, `UserInfo` を全てクラスとして実装（`toJSON()` 含む）。`UserRecord` をクラスに変更。`parseDate` ヘルパー、`B64_REDACTED` チェック（完了済み）。                                                                                                                                                                                                                                                                                     |
| 18  | `auth/action-code-settings-builder.ts` | 142    | ~45      | コンストラクタに全バリデーション追加（URL必須チェック、handleCodeInApp型チェック等）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 19  | `auth/auth-api-request.ts`             | 2324   | ~1884    | **2番目に大きいファイル。** 全APIエンドポイント設定、バリデータ関数（`validateCreateEditRequest`, `validateAuthFactorInfo`, `validateProviderUserInfo`）。`AbstractAuthRequestHandler` の全メソッド（CRUD, import, email links, provider config）。`AuthRequestHandler` の全メソッド（tenant CRUD, project config）。`TenantAwareAuthRequestHandler` クラス。`AuthHttpClient`, `TenantAwareAuthResourceUrlBuilder`。`RESERVED_CLAIMS`, `EMAIL_ACTION_REQUEST_TYPES`, 各種`MAX_*`定数。`useEmulator()` で環境変数読み取り。`getAccountInfoByIdentifiers` にバッチサイズ上限チェック追加。 |
| 20  | `auth/base-auth.ts`                    | 1143   | ~310     | `GetUsersResult`, `ListUsersResult`, `DeleteUsersResult` インターフェース。`getUserByProviderUid`, `getUsers`, `listUsers`, `createUser`, `deleteUser`, `deleteUsers`, `updateUser`, `setCustomUserClaims`, `importUsers`, `generatePasswordResetLink`, `generateEmailVerificationLink`, `generateVerifyAndChangeEmailLink`, `generateSignInWithEmailLink`, `listProviderConfigs`, `getProviderConfig`, `deleteProviderConfig`, `updateProviderConfig`, `createProviderConfig` の全publicメソッド。`authBlockingTokenVerifier` フィールドと `_verifyAuthBlockingToken`。                 |
| 21  | `auth/token-generator.ts`              | 244    | ~15      | `handleCryptoSignerError` にサーバーエラー詳細抽出追加（`fromServerError` 呼び出し）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 22  | `auth/token-verifier.ts`               | 634    | ~100     | `DecodedAuthBlocking*` インターフェース7個。`AUTH_BLOCKING_TOKEN_INFO` 定数。`verifyContent` に`audience` パラメータと`event_type` 例外処理追加。`createAuthBlockingTokenVerifier` ファクトリ。`_verifyAuthBlockingToken` メソッド。                                                                                                                                                                                                                                                                                                                                                     |
| 23  | `auth/user-import-builder.ts`          | 762    | ~600     | `HashAlgorithmType` 型。全内部インターフェース（`UserMetadataRequest`, `UserProviderRequest`, `UploadAccountUser` 等）。`populateUploadAccountUser()`, `populateOptions()`（全ハッシュアルゴリズム検証）, `populateUsers()`, `buildRequest()`, `buildResponse()` の完全実装。`convertMultiFactorInfoToServerFormat` の完全実装。                                                                                                                                                                                                                                                         |
| 24  | `auth/tenant.ts`                       | 428    | ~374     | `UpdateTenantRequest` 全フィールド。`CreateTenantRequest` 型エイリアス。`TenantOptionsServerRequest`, `TenantServerResponse` 正しいフィールド。`Tenant` クラス（全プロパティ、コンストラクタ、`toJSON()`, `buildServerRequest()`, `validate()`, `getTenantIdFromResourceName()`）。                                                                                                                                                                                                                                                                                                      |
| 25  | `auth/tenant-manager.ts`               | 276    | ~252     | `ListTenantsResult` インターフェース。`TenantAwareAuth` クラス（`verifyIdToken`, `createSessionCookie`, `verifySessionCookie`）。`TenantManager` クラス（`authForTenant`, `getTenant`, `listTenants`, `deleteTenant`, `createTenant`, `updateTenant`）。                                                                                                                                                                                                                                                                                                                                 |
| 26  | `auth/project-config.ts`               | 301    | ~248     | `UpdateProjectConfigRequest` 全フィールド。`ProjectConfigServerResponse`, `ProjectConfigClientRequest`。`ProjectConfig` クラス（全プロパティ、`buildServerRequest()`, `validate()`, `toJSON()`）。                                                                                                                                                                                                                                                                                                                                                                                       |
| 27  | `auth/project-config-manager.ts`       | 64     | ~40      | `ProjectConfigManager` クラス（`getProjectConfig`, `updateProjectConfig`）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 28  | `auth/auth.ts`                         | 42     | ~10      | `tenantManager()` ゲッター、`projectConfigManager()` ゲッター追加。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 29  | `auth/identifier.ts`                   | 55     | 0        | 完了済み                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 30  | `auth/auth-namespace.ts`               | 382    | ~358     | 52個の型再エクスポート。`auth()` 関数宣言。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 31  | `auth/index.ts`                        | 97     | ~60      | 全型エクスポート追加。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 実装戦略

### 1ファイルずつ元実装を参照しながら実装

各ファイルについて:

1. 元実装（`opensrc/repos/github.com/firebase/firebase-admin-node/src/`）を読む
2. Node.js依存を`fetch`+`jose`に置換しながら移植
3. `bunx tsc --noEmit`で型エラーチェック
4. 次のファイルへ

### 並列化戦略

Phase 1は`utils/`内で直列（依存関係あり）。
Phase 2は`app/`内で直列。
Phase 3は`auth/`内で依存関係順:

- 先に`auth-config.ts`と`user-record.ts`（他が依存）
- 次に`auth-api-request.ts`（`auth-config`に依存）
- 次に`base-auth.ts`, `token-generator.ts`, `token-verifier.ts`, `user-import-builder.ts`（並列可能）
- 次に`tenant.ts`, `project-config.ts`（並列可能）
- 次に`tenant-manager.ts`, `project-config-manager.ts`
- 最後に`auth.ts`, `auth-namespace.ts`, `index.ts`

## 検証

各ファイル実装後に:

```bash
cd apps/api && bunx tsc --noEmit
```

全ファイル完了後に:

```bash
bun run check-types
bun run test --filter=api
bun run lint
```
