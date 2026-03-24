# Plan: firebase-admin を置き換える Edge Runtime 対応 Firebase Auth パッケージ

## Context

Hono API を Cloudflare Workers にデプロイしたいが、`firebase-admin` は Node.js ランタイムに依存するため Edge Runtime では動作しない。現在 `firebase-admin` を使っているのは Auth 機能のみ（PostgreSQL は Drizzle ORM で別途管理）。

`firebase-rest-firestore` (nabettu) のアプローチを参考に、`jose` ライブラリで JWT を署名し Firebase REST API 経由で認証を行うパッケージを `packages/firebase-admin-rest` に作成する。

## 現状の firebase-admin 使用箇所

| ファイル                                            | 使用機能                                                |
| --------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/shared/firebase-admin.ts`             | `initializeApp`, `cert`, `getAuth`                      |
| `apps/api/src/shared/middleware/auth.middleware.ts` | `verifySessionCookie(sessionCookie)` → `DecodedIdToken` |
| `apps/api/src/features/auth/route.ts`               | `createSessionCookie(idToken, expiresIn)`               |
| `apps/api/src/shared/db/rls.ts`                     | `DecodedIdToken` 型のみ使用                             |
| `apps/api/src/shared/types/hono.d.ts`               | `DecodedIdToken` 型のみ使用                             |

## 実装計画

### Step 1: `packages/firebase-admin-rest` パッケージを作成

#### `packages/firebase-admin-rest/package.json`

```json
{
	"name": "@repo/firebase-admin-rest",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"dependencies": {
		"jose": "^4.14.4"
	}
}
```

#### `packages/firebase-admin-rest/src/types.ts`

- `DecodedIdToken` インターフェースを定義（`firebase-admin/auth` からの置き換え）
  - `uid`, `email`, `email_verified`, `displayName`, `photoURL`, `iss`, `aud`, `auth_time`, `sub`, `iat`, `exp`, `firebase` 等

#### `packages/firebase-admin-rest/src/token.ts`

- `createJWT(privateKey, clientEmail)` — サービスアカウントの秘密鍵で JWT を作成（`jose` 使用）
- `getAccessToken(privateKey, clientEmail)` — OAuth2 トークンを取得・キャッシュ（firebase-rest-firestore の `getFirestoreToken` を参考）
- 参考: `nabettu/firebase-rest-firestore/src/utils/auth.ts`

#### `packages/firebase-admin-rest/src/session.ts`

- `createSessionCookie(idToken, expiresIn, config)` — Firebase Auth REST API (`v1/projects/{projectId}:createSessionCookie`) を呼び出し
  - エンドポイント: `POST https://identitytoolkit.googleapis.com/v1/projects/{projectId}:createSessionCookie`
  - Body: `{ idToken, expiresIn }`
  - ヘッダー: `Authorization: Bearer {accessToken}`
- `verifySessionCookie(sessionCookie, config)` — JWT 公開鍵（`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`）でセッションクッキーを検証し claims を返す
  - `jose` の `jwtVerify` と `importSPKI` を使用
  - セッションクッキーは Firebase 署名済み JWT なので、公開鍵でローカル検証可能（API 呼び出し不要）

#### `packages/firebase-admin-rest/src/config.ts`

- `formatPrivateKey(key)` — `\n` エスケープを実際の改行に変換
- `FirebaseAuthConfig` 型: `{ projectId, privateKey, clientEmail }`

#### `packages/firebase-admin-rest/src/index.ts`

- 全ての型と関数を re-export

### Step 2: `apps/api` 側の変更

#### `apps/api/src/shared/firebase-admin.ts` → 削除

#### `apps/api/src/shared/firebase-auth.ts` → 新規作成

- `getFirebaseAuthConfig(c: Context)` — Hono Context から環境変数を取得して `FirebaseAuthConfig` を返す
- `createSessionCookie(c: Context, idToken: string, expiresIn: number)` — ラッパー
- `verifySessionCookie(c: Context, sessionCookie: string)` — ラッパー

#### `apps/api/src/shared/middleware/auth.middleware.ts`

- `import { getFirebaseAuth } from "../firebase-admin"` → `import { verifySessionCookie } from "../firebase-auth"`
- `DecodedIdToken` の import を `@repo/firebase-admin-rest` に変更
- `getFirebaseAuth(c).verifySessionCookie(sessionCookie)` → `verifySessionCookie(c, sessionCookie)`

#### `apps/api/src/features/auth/route.ts`

- `import { getFirebaseAuth } from "../../shared/firebase-admin"` → `import { createSessionCookie } from "../../shared/firebase-auth"`
- `getFirebaseAuth(c).createSessionCookie(idToken, { expiresIn })` → `createSessionCookie(c, idToken, SESSION_COOKIE_MAX_AGE_MS)`

#### `apps/api/src/shared/db/rls.ts`

- `import type { DecodedIdToken } from "firebase-admin/auth"` → `import type { DecodedIdToken } from "@repo/firebase-admin-rest"`

#### `apps/api/src/shared/types/hono.d.ts`

- `import type { DecodedIdToken } from "firebase-admin/auth"` → `import type { DecodedIdToken } from "@repo/firebase-admin-rest"`

#### `apps/api/package.json`

- `"firebase-admin"` を dependencies から削除
- `"@repo/firebase-admin-rest": "workspace:*"` を dependencies に追加

### Step 3: 依存関係のインストール

- `bun install` を実行

## 変更ファイル一覧

| 操作     | ファイルパス                                        |
| -------- | --------------------------------------------------- |
| **新規** | `packages/firebase-admin-rest/package.json`         |
| **新規** | `packages/firebase-admin-rest/src/index.ts`         |
| **新規** | `packages/firebase-admin-rest/src/types.ts`         |
| **新規** | `packages/firebase-admin-rest/src/token.ts`         |
| **新規** | `packages/firebase-admin-rest/src/session.ts`       |
| **新規** | `packages/firebase-admin-rest/src/config.ts`        |
| **新規** | `apps/api/src/shared/firebase-auth.ts`              |
| **変更** | `apps/api/src/shared/middleware/auth.middleware.ts` |
| **変更** | `apps/api/src/features/auth/route.ts`               |
| **変更** | `apps/api/src/shared/db/rls.ts`                     |
| **変更** | `apps/api/src/shared/types/hono.d.ts`               |
| **変更** | `apps/api/package.json`                             |
| **削除** | `apps/api/src/shared/firebase-admin.ts`             |

## 検証方法

1. `bun install` — 依存関係の解決
2. `cd apps/api && bun run check-types` — 型チェックが通ることを確認
3. `bun run dev` — ローカルで API を起動し、サインイン/サインアップ/ユーザー取得が正常動作することを確認
