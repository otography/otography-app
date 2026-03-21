# 認証基盤の移行計画: Supabase Auth → Firebase Auth + Drizzle ORM

## Context

現在のプロジェクトでは認証にSupabase Auth（`@supabase/ssr`）を使用しているが、以下の課題がある：

1. **SDK依存**: バックエンドAPIでSupabase JS SDKへの依存がある
2. **RLS未対応**: Drizzle ORMでのRLS（Row Level Security）対応が未実装
3. **柔軟性**: 認証プロバイダーの変更やカスタマイズが困難

これらを解決するため、Firebase Authへの移行とDrizzle ORMでのRLS有効化を行う。

---

## 目標

- Supabase JS SDKへの依存を完全に排除
- Firebase Authによる認証に移行
- Drizzle ORMでRLSを有効化
- Honoの `jwk` ミドルウェアでJWT検証

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend API   │     │   Supabase DB   │
│ (Firebase SDK)  │────▶│   (Hono+Drizzle)│────▶│   (RLS有効)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  ID Token             │  set_config()         │
        │  (Authorization)      │  user_id, role        │
        ▼                       ▼                       ▼
```

---

## 実装計画

### Phase 1: 環境設定と依存関係の更新

#### 1.1 パッケージの追加・削除

```bash
# 追加（フロントエンド用）
bun add firebase

# 削除
bun remove @supabase/ssr @supabase/supabase-js
```

#### 1.2 環境変数の更新

```typescript
// apps/api/src/env.ts
export const env = createEnv({
	server: {
		DATABASE_URL: type("string.url"),
		// Firebase Auth設定
		FIREBASE_PROJECT_ID: type("string>0"),
		// 削除
		// SUPABASE_URL: ...
		// SUPABASE_PUBLISHABLE_KEY: ...
	},
});
```

---

### Phase 2: Firebase Auth JWT検証ミドルウェア

#### 2.1 Hono jwk ミドルウェアの設定

```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
import { jwk } from "hono/jwk";

const app = new Hono();

// Firebase Auth JWKS エンドポイント
app.use(
	"/api/*",
	jwk({
		jwks_uri:
			"https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
		alg: ["RS256"],
		// 多層防御: アプリケーション層での iss/aud 検証
		verification: {
			iss: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
			aud: process.env.FIREBASE_PROJECT_ID,
		},
	}),
);

export default app;
```

**ポイント**:

- `verification`オプションで`iss`（Issuer）と`aud`（Audience）を明示的に検証
- これにより、他のFirebaseプロジェクト用のJWTが拒否されます

#### 2.2 型定義

```typescript
// apps/api/src/shared/types/hono.d.ts
import "hono";

// Firebase Auth JWT ペイロード型
export interface FirebaseClaims {
	sub: string; // Firebase UID
	iss: string; // https://securetoken.google.com/{projectId}
	aud: string; // {projectId}
	exp: number;
	iat: number;
	auth_time: number;
	user_id: string; // Firebase UID (subと同じ)
	email?: string;
	email_verified?: boolean;
	name?: string;
	picture?: string;
	firebase: {
		identities: Record<string, string[]>;
		sign_in_provider: string;
	};
}

declare module "hono" {
	interface ContextVariableMap {
		jwtPayload: FirebaseClaims;
		userId: string;
	}
}
```

---

### Phase 3: RLS用関数（汎用PostgreSQL）

#### 3.1 制限的RLSポリシー関数

```sql
-- Supabase SQL Editorで実行
-- Firebase AuthのJWTが正しいプロジェクトから発行されたかを検証する関数
--
-- 【役割】: JWTが正しいFirebaseプロジェクトから発行されたかを検証
-- 【なぜ必要】: Firebase Authは全プロジェクトで共通の署名鍵を使用するため、
--              他のFirebaseプロジェクトのJWTでも署名検証に成功してしまう。
--              この関数で iss（issuer）と aud（audience）をチェックし、
--              自分のプロジェクトのJWTのみを許可する。

create or replace function public.is_firebase_project_jwt()
returns bool
language sql
stable
returns null on null input
return (
  current_setting('request.jwt.claims', true)::json->>'iss'
    = 'https://securetoken.google.com/<firebase-project-id>'
  and
  current_setting('request.jwt.claims', true)::json->>'aud'
    = '<firebase-project-id>'
);
```

**注意**: `<firebase-project-id>` はFirebase プロジェクトIDに置き換えてください。

#### 3.2 ユーザーID取得関数

```sql
-- Firebase Auth のユーザーIDを取得する関数
create or replace function requesting_user_id()
returns text as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ language sql stable;
```

**注意**: RLSポリシーの定義はPhase 5でDrizzle ORMの`pgPolicy`を使用して行います。

---

### Phase 4: RLS対応DBクライアント

```typescript
// apps/api/src/shared/db/rls.ts
import { sql } from "drizzle-orm";
import { db } from "./index";
import type { FirebaseClaims } from "../types/hono";

export async function withRls<T>(
	claims: FirebaseClaims,
	fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		// Firebase Auth の JWT クレームを設定
		// is_firebase_project_jwt() 関数が参照する設定
		const jwtClaims = JSON.stringify({
			sub: claims.sub,
			uid: claims.user_id,
			email: claims.email,
			iss: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
			aud: process.env.FIREBASE_PROJECT_ID,
			firebase: claims.firebase,
			role: "authenticated",
		});

		await tx.execute(sql`
      select set_config('request.jwt.claims', ${jwtClaims}, TRUE);
      set local role "authenticated";
    `);

		return fn(tx);
	});
}
```

**ポイント**:

- `iss` クレームに `https://securetoken.google.com/<firebase-project-id>` を設定
- `aud` クレームにFirebase プロジェクトIDを設定
- これにより `is_firebase_project_jwt()` 関数が正しく動作

---

### Phase 5: ユーザーテーブル設計

```typescript
// apps/api/src/shared/db/schema.ts
import { pgTable, text, timestamp, pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 汎用PostgreSQL用ロール定義（Supabase依存を排除）
const authenticatedRole = pgRole("authenticated");

export const profiles = pgTable(
	"profiles",
	{
		id: text("id").primaryKey(), // Firebase UID
		email: text("email"),
		displayName: text("display_name"),
		photoUrl: text("photo_url"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		// 制限的ポリシー（Firebase プロジェクト検証用）
		// これを追加すると自動的にRLSが有効になる
		pgPolicy("Restrict access to correct Firebase project", {
			as: "restrictive",
			to: authenticatedRole,
			for: "all",
			using: sql`(select public.is_firebase_project_jwt()) is true`,
		}),
		// 通常のRLSポリシー
		pgPolicy("users_can_read_own_profile", {
			for: "select",
			to: authenticatedRole,
			using: sql`id = requesting_user_id()`,
		}),
		pgPolicy("users_can_update_own_profile", {
			for: "update",
			to: authenticatedRole,
			using: sql`id = requesting_user_id()`,
		}),
	],
);
```

**重要**:

- `pgPolicy`を追加すると自動的にRLSが有効になります（`.enableRLS()`は不要）
- `authenticatedRole`は`drizzle-orm/supabase`からインポート
- `as: "restrictive"`ポリシーは権限を付与するものではなく、既存の権限を制限します

#### drizzle.config.ts の設定

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./apps/api/src/shared/db/schema.ts",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
```

---

### Phase 6: ルート実装例

```typescript
// apps/api/src/features/auth/route.ts
import { Hono } from "hono";
import { jwk } from "hono/jwk";
import { withRls } from "../../shared/db/rls";
import { profiles } from "../../shared/db/schema";
import { sql } from "drizzle-orm";

const auth = new Hono();

// JWT検証ミドルウェア
auth.use(
	"/api/*",
	jwk({
		jwks_uri:
			"https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
		alg: ["RS256"],
		verification: {
			iss: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
			aud: process.env.FIREBASE_PROJECT_ID,
		},
	}),
);

// 現在のユーザー情報取得
auth.get("/api/user", async (c) => {
	const claims = c.get("jwtPayload");

	// プロファイル取得または作成
	const [profile] = await withRls(claims, (tx) =>
		tx
			.insert(profiles)
			.values({
				id: claims.sub,
				email: claims.email,
				displayName: claims.name,
				photoUrl: claims.picture,
			})
			.onConflictDoUpdate({
				target: profiles.id,
				set: {
					email: sql`excluded.email`,
					displayName: sql`excluded.display_name`,
					photoUrl: sql`excluded.photo_url`,
					updatedAt: sql`now()`,
				},
			})
			.returning(),
	);

	return c.json({
		message: "You are logged in!",
		userId: claims.sub,
		profile,
	});
});

// サインアウト（クライアントサイドで処理)
auth.post("/api/signout", async (c) => {
	// Firebase Authはクライアントサイドでサインアウト処理
	// バックエンドでは何もする必要がない
	return c.body(null, 204);
});

export default auth;
```

---

### Phase 7: フロントエンド設定

```typescript
// apps/web/src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google サインイン
export const signInWithGoogle = async () => {
	const provider = new GoogleAuthProvider();
	return signInWithPopup(auth, provider);
};

// ID トークンを取得してバックエンドに送信
export const getIdToken = async () => {
	const user = auth.currentUser;
	if (user) {
		return user.getIdToken();
	}
	return null;
};
```

---

## 変更対象ファイル

| ファイル                              | 変更内容                                                |
| ------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/env.ts`                 | 環境変数の更新（Supabase削除、Firebase追加）            |
| `apps/api/src/shared/types/hono.d.ts` | 新規作成（型定義）                                      |
| `apps/api/src/shared/db/rls.ts`       | 新規作成（RLSヘルパー）                                 |
| `apps/api/src/shared/db/schema.ts`    | プロファイルテーブル、RLSポリシー追加（`pgPolicy`使用） |
| `apps/api/src/features/auth/route.ts` | Firebase Auth認証へ移行                                 |
| `apps/web/src/lib/firebase.ts`        | 新規作成（フロントエンド用）                            |
| `drizzle.config.ts`                   | Supabaseロール除外設定を追加                            |
| `package.json`                        | 依存パッケージの更新                                    |

---

## 検証方法

1. **JWT検証テスト（アプリケーション層）**
   - Firebase Auth でサインイン後、`/api/user` にアクセス
   - Authorization ヘッダーにBearer トークンを設定
   - JWTペイロードが正しく返ることを確認

2. **iss/aud検証テスト（多層防御確認）**
   - 他のFirebaseプロジェクトのJWTを使用してアクセス
   - 401 Unauthorized が返ることを確認
   - アプリケーション層（Hono）とDB層（RLS）の両方で拒否されることを確認

3. **RLSテスト（データベース層）**
   - ユーザーAでデータ作成
   - ユーザーBで同じテーブルをクエリ
   - ユーザーAのデータが見えないことを確認

4. **プロファイル作成テスト**
   - 初回アクセスでプロファイルが自動作成されることを確認

---

## 参考リンク

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Verify ID Tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Drizzle ORM RLS](https://orm.drizzle.team/docs/rls)
- [Hono jwk Middleware](https://hono.dev/docs/middleware/builtin/jwk)
