# Plan: Cloudflare Workers-compatible Firebase Admin (app + auth)

## Context

`firebase-admin` v13.7.0 は Node.js 固有の API (`google-auth-library`, `jsonwebtoken`, `jwks-rsa`, `node-forge` 等) を使用し、Cloudflare Workers で動作しない。`apps/api/src/lib/firebase-admin-rest/` に **全auth メソッド対応** のドロップインリプレイスメントを作成する。

**前提条件:**

- **`nodejs_compat` フラグ** 有効 (compatibility date ≥ 2024-09-23)
- **`jose` v6.2.2** — プロジェクト既存依存。Workers でネイティブ動作

## `nodejs_compat` によりそのまま動作する API

| API            | サポート  | 影響                                       |
| -------------- | --------- | ------------------------------------------ |
| `Buffer`       | 🟢        | `isBuffer()`, `Buffer.from()` そのまま     |
| `crypto`       | 🟢        | `crypto.createSign('RSA-SHA256')` そのまま |
| `http`/`https` | 🟢        | `fetch()` の方がシンプルなので置き換え     |
| `process`      | 🟢        | `process.env` そのまま                     |
| `http2`        | 🟡 非機能 | 削除必要                                   |

## `jose` が置き換える npm パッケージ

| 置き換え対象          | jose での代替                                     |
| --------------------- | ------------------------------------------------- |
| `jsonwebtoken`        | `jose.jwtVerify()`, `jose.decodeJwt()`            |
| `jwks-rsa`            | `jose.createRemoteJWKSet()` (キャッシュ内蔵)      |
| `node-forge` PEM検証  | `jose.importPKCS8()` (フォーマット検証内蔵)       |
| `google-auth-library` | `jose.SignJWT` + `jose.importPKCS8()` + `fetch()` |

## Directory Structure

```
apps/api/src/lib/firebase-admin-rest/
├── index.ts                       # Package entry
├── app/
│   ├── index.ts                   # Barrel exports
│   ├── core.ts                    # App, AppOptions interfaces
│   ├── credential.ts              # Credential, ServiceAccount interfaces
│   ├── credential-internal.ts     # ServiceAccountCredential (jose + fetch) [C]
│   ├── credential-factory.ts      # cert() factory [B]
│   ├── firebase-app.ts            # FirebaseApp + FirebaseAppInternals
│   └── lifecycle.ts               # AppStore, initializeApp(), getApp() [B]
├── auth/
│   ├── index.ts                   # getAuth() + barrel exports
│   ├── auth.ts                    # Auth class
│   ├── auth-api-request.ts        # AuthRequestHandler (fetch-based api-request使用)
│   ├── auth-config.ts             # Auth config types/validators
│   ├── base-auth.ts               # 全authメソッド
│   ├── action-code-settings-builder.ts
│   ├── identifier.ts
│   ├── project-config.ts
│   ├── project-config-manager.ts
│   ├── tenant.ts
│   ├── tenant-manager.ts
│   ├── token-verifier.ts          # FirebaseTokenVerifier + DecodedIdToken
│   ├── token-generator.ts         # FirebaseTokenGenerator
│   ├── user-import-builder.ts
│   └── user-record.ts
└── utils/
    ├── index.ts                   # Utility functions [B]
    ├── api-request.ts             # fetch-based HttpClient [C]
    ├── crypto-signer.ts           # crypto.createSign() (nodejs_compat) [B]
    ├── deep-copy.ts               # deepCopy/deepExtend
    ├── error.ts                   # FirebaseError, FirebaseAuthError, error codes
    ├── jwt.ts                     # jose-based JWT decode/verify [C]
    └── validator.ts               # Type validation functions
```

## File Classification

### A. Copy as-is (変更不要、import pathのみ確認)

**utils:** `validator.ts`, `deep-copy.ts`
**app:** `credential.ts`, `firebase-app.ts`
**auth:** `index.ts`, `auth.ts`, `base-auth.ts`, `auth-api-request.ts`, `token-verifier.ts`, `token-generator.ts`, `action-code-settings-builder.ts`, `auth-config.ts`, `identifier.ts`, `project-config.ts`, `project-config-manager.ts`, `tenant.ts`, `tenant-manager.ts`, `user-import-builder.ts`, `user-record.ts`

→ auth ファイルは **全て外部npm依存なし**。`Buffer`のみ使用（nodejs_compat対応）。import path 修正のみ。

### B. Minor changes (軽微な修正)

| ファイル                    | 変更内容                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `utils/crypto-signer.ts`    | IAMSigner削除、`jsonwebtoken`のAlgorithm型 → inline `"RS256"`、`require('crypto')` → `import crypto from 'crypto'` |
| `utils/index.ts`            | `require('package.json')` 削除、`getSdkVersion()` 固定値化、`ApplicationDefaultCredential` import削除              |
| `app/core.ts`               | `http.Agent` をAppOptionsから削除                                                                                  |
| `app/lifecycle.ts`          | `fs.readFileSync` auto-init削除、`fast-deep-equal` → `JSON.stringify`比較、`httpAgent` 関連削除                    |
| `app/credential-factory.ts` | `httpAgent` param削除、`RefreshTokenCredential`/`refreshToken()` 削除                                              |

### C. Significant rewrite (外部npmパッケージ依存の置き換え)

| ファイル                     | 置き換え                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `utils/jwt.ts`               | `jsonwebtoken`/`jwks-rsa` → `jose`                                                     |
| `utils/api-request.ts`       | Node.js http/https/http2 (~1400行) → fetch-based (~150行)                              |
| `app/credential-internal.ts` | `google-auth-library`/`node-forge` → `jose.SignJWT` + `jose.importPKCS8()` + `fetch()` |

## C カテゴリ実装詳細

### C1. `utils/jwt.ts` — jose-based JWT verification

```
依存: jose (プロジェクト既存 v6.2.2)

保持する公開API:
- DecodedToken型, Dictionary型
- SignatureVerifier interface
- PublicKeySignatureVerifier class
- EmulatorSignatureVerifier class
- ALGORITHM_RS256定数
- decodeJwt(token) → Promise<DecodedToken>
- verifyJwtSignature(token, secretOrPublicKey, options?) → Promise<void>
- JwtError class, JwtErrorCode enum

実装:
  decodeJwt(token): jose.decodeJwt(token) + jose.decodeProtectedHeader(token) → { header, payload }
  verifyJwtSignature(token, key):
    - key が文字列 (PEM) → jose.importSPKI(key, 'RS256') → jose.jwtVerify(token, cryptoKey)
    - key が関数 (getKey callback) → jose.jwtVerify(token, key)
    - 期限切れ → JwtError.TOKEN_EXPIRED
    - 署名不正 → JwtError.INVALID_SIGNATURE

PublicKeySignatureVerifier:
  - withCertificateUrl(url): jose.createRemoteJWKSet(new URL(url)) を保持
  - verify(token): jose.jwtVerify(token, this.jwks, { algorithms: ['RS256'] })

EmulatorSignatureVerifier:
  - verify(token): jose.decodeJwt(token) のみ (署名検証スキップ)

削除: UrlKeyFetcher, JwksFetcher (jose.createRemoteJWKSetが代替)
削除: getKeyCallback (joseが内部処理)
```

### C2. `utils/api-request.ts` — fetch-based HTTP client

```
保持する公開API:
- ApiSettings class
- HttpRequestConfig interface
- RequestResponseError class
- HttpClient class
- AuthorizedHttpClient class

HttpClient:
  send(config) → fetch(url, { method, headers, body })
  → ApiResponse { status, headers, data (JSON parsed), text }
  → JSONレスポンス → resp.isJson() === true
  → 503 のみリトライ (1回)
  → タイムアウト: AbortController 使用

AuthorizedHttpClient:
  send(config) → app.INTERNAL.getToken() → inject Authorization header → HttpClient.send()

削除: Http2SessionHandler, AsyncHttpCall, AsyncHttp2Call
削除: ExponentialBackoffPoller
削除: handleMultipartResponse (@fastify/busboy依存)
削除: gzip/zlib 圧縮解除 (Workers は自動対応)
```

### C3. `app/credential-internal.ts` — jose OAuth2

```
依存: jose, fetch

ServiceAccountCredential:
  constructor(object) → projectId, privateKey, clientEmail を抽出
    - node-forge PEM検証 → jose.importPKCS8(privateKey, 'RS256') で検証
    - fs.readFileSync パス → 削除 (オブジェクトのみ対応)
    - google-auth-library → 削除

  getAccessToken():
    1. jose.importPKCS8(privateKey, 'RS256') → CryptoKey (キャッシュ可)
    2. new jose.SignJWT({})
         .setProtectedHeader({ alg: 'RS256' })
         .setIssuer(clientEmail)
         .setSubject(clientEmail)
         .setAudience('https://oauth2.googleapis.com/token')
         .setIssuedAt()
         .setExpirationTime('1h')
         .sign(cryptoKey) → signedJWT
    3. POST https://oauth2.googleapis.com/token
         body: URLSearchParams({ grant_type, assertion })
    4. Return { access_token, expires_in }

getApplicationDefault():
  → 削除 (Workers では使用不可。常に cert() で明示的に初期化)

削除: ApplicationDefaultCredential, RefreshTokenCredential, ImpersonatedServiceAccountCredential
削除: google-auth-library, node-forge, fs 依存
```

## Execution Order

### 現在の状態

- ✅ Step 1 完了: A/B/C カテゴリ 19ファイルコピー済み
- ✅ Step 2 一部完了: `error.ts` の messaging import 削除済み
- ⚠️ 追加: auth 9ファイル未コピー

### Step 1.5: 残りのauth ファイルをコピー

```bash
cd apps/api/src/lib/firebase-admin-rest
for f in action-code-settings-builder.ts auth-config.ts identifier.ts \
  project-config-manager.ts project-config.ts tenant-manager.ts tenant.ts \
  user-import-builder.ts user-record.ts; do
  cp $SRC/auth/$f auth/$f
done
```

### Step 2: B カテゴリ — 軽微修正 (5ファイル)

- `utils/crypto-signer.ts`: IAMSigner削除, Algorithm型→inline, require→import
- `utils/index.ts`: require('package.json')削除, ApplicationDefaultCredential削除
- `app/core.ts`: http.Agent削除
- `app/lifecycle.ts`: fs, fast-deep-equal削除, httpAgent関連削除
- `app/credential-factory.ts`: httpAgent, RefreshTokenCredential, refreshToken()削除

### Step 3: C カテゴリ — 大きな修正 (3ファイル)

- `utils/jwt.ts`: jsonwebtoken/jwks-rsa → jose
- `utils/api-request.ts`: Node.js http → fetch-based
- `app/credential-internal.ts`: google-auth-library/node-forge → jose + fetch

### Step 4: `firebase-app.ts` 修正

- `httpAgent` 参照の削除 (core.tsから削除したため)
- `getApplicationDefault` の呼び出しを削除 (credential必須にする)

### Step 5: barrel exports 作成

- `app/index.ts`: `initializeApp`, `getApp`, `getApps`, `deleteApp`, `cert`, `App`, `AppOptions` 等
- `auth/index.ts`: `getAuth`, `Auth`, `FirebaseAuthError`, `DecodedIdToken`, 全auth型
- `index.ts` (ルート): app + auth をre-export

### Step 6: Import更新 + 検証

- `apps/api/src/shared/firebase-auth.ts`: import path変更
- `packages/errors/src/auth-error.ts`: import path変更
- `bun run check-types` — 型エラーゼロ
- `bun run test --filter=api` — テスト通過
- `bun run test --filter=@repo/errors` — テスト通過

## Verification

1. `bun run check-types` — 型エラーゼロ
2. `bun run test --filter=api` — 既存テスト全通過
3. `bun run test --filter=@repo/errors` — エラーパッケージテスト通過
