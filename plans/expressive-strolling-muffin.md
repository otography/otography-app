# Plan: Replace `@repo/firebase-admin-rest` with official `firebase-admin`

## Context

Cloudflare Workers デプロイを諦め、Node.js/Bun が動く環境にデプロイする方針に変更。これにより公式 `firebase-admin` SDK が使えるようになる。自作の `packages/firebase-admin-rest` を公式 SDK に置き換える。

**設計原則**: API のみが信頼境界。フロントエンドは認証情報・クレデンシャルを一切扱わない。Supabase PostgreSQL (RLS) 連携は維持。

## API 対応表

| カスタムパッケージ                            | 公式 `firebase-admin`            |
| --------------------------------------------- | -------------------------------- |
| `cert()` from `@repo/firebase-admin-rest/app` | `admin.credential.cert()`        |
| `initializeApp()`                             | `admin.initializeApp()`          |
| `getAuth()`                                   | `admin.auth()`                   |
| `FirebaseAuthError`                           | `admin.auth.AuthError`           |
| `isFirebaseAuthError()`                       | `instanceof AuthError`           |
| `AuthClientErrorCode`                         | `admin.auth.AuthClientErrorCode` |
| `SessionCookiePayload` (= `DecodedIdToken`)   | `admin.auth.DecodedIdToken`      |

## 変更手順

### 1. `apps/api/package.json` — 依存変更

- Remove `"@repo/firebase-admin-rest": "workspace:*"`
- Add `"firebase-admin": "^13.0.0"`

### 2. `apps/api/src/shared/firebase-auth.ts` — 書き換え

per-request 初期化 → モジュールスコープのシングルトンに変更。`getBootEnv()` で `process.env` から一度だけ読む。

```ts
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getBootEnv } from "../env";

const env = getBootEnv();

const firebaseAuth = getAuth(
	initializeApp({
		credential: cert({
			clientEmail: env.FIREBASE_CLIENT_EMAIL,
			privateKey: env.FIREBASE_PRIVATE_KEY,
			projectId: env.FIREBASE_PROJECT_ID,
		}),
		projectId: env.FIREBASE_PROJECT_ID,
	}),
);

export { firebaseAuth };
```

### 3. `apps/api/src/shared/firebase-auth-error.ts` — import 置き換え

- `AuthClientErrorCode`, `FirebaseAuthError`, `isFirebaseAuthError` → `AuthClientErrorCode`, `AuthError` from `firebase-admin/auth`
- `isFirebaseAuthError(error)` → `error instanceof AuthError`
- `new FirebaseAuthError(code, msg, { cause })` → `new AuthError(code, msg)` + 手動 `cause` 設定 (公式SDKのコンストラクタは `cause` オプション非対応)
- 型アノテーション `FirebaseAuthError` → `AuthError`

### 4. `apps/api/src/shared/db/rls.ts` — 型 import 置き換え

- `SessionCookiePayload` from `@repo/firebase-admin-rest` → `DecodedIdToken` from `firebase-admin/auth`

### 5. `apps/api/src/shared/types/hono.d.ts` — 型 import 置き換え

- `FirebaseAuthError` → `AuthError`
- `SessionCookiePayload` → `DecodedIdToken`

### 6. `apps/api/src/shared/middleware/auth.middleware.ts` — 呼び出し変更

- `import { getFirebaseAuth }` → `import { firebaseAuth }`
- `getFirebaseAuth(c).verifySessionCookie(...)` → `firebaseAuth.verifySessionCookie(...)`

### 7. `apps/api/src/features/auth/route.ts` — 呼び出し変更

- `import { getFirebaseAuth }` → `import { firebaseAuth }`
- `getFirebaseAuth(c).createSessionCookie(...)` → `firebaseAuth.createSessionCookie(...)`
- `getFirebaseAuth(c).revokeRefreshTokens(...)` → `firebaseAuth.revokeRefreshTokens(...)`
- ※ `const auth = new Hono()` と名前が衝突しないよう `firebaseAuth` にリネーム

### 8. `packages/firebase-admin-rest/` — ディレクトリ削除

参照箇所がゼロになるため削除。

### 9. `bun install` + `bun run check-types`

## 変更しないファイル

- `firebase-rest.ts` — Identity Toolkit REST 呼び出し (Admin SDK とは無関係)
- `oauth.ts` — OAuth トークン交換 (Admin SDK とは無関係)
- `session.ts` — クッキー管理 (Firebase 非依存)
- `csrf.middleware.ts` — CSRF 保護 (Firebase 非依存)
- `apps/web/*` — フロントエンド全体 (Firebase 非依存)

## Verification

1. `bun install` — 依存解決確認
2. `bun run check-types` — 型チェック通過
3. `bun run dev` — API サーバー起動確認
4. ブラウザでログイン/ログアウト フローが動作することを確認
