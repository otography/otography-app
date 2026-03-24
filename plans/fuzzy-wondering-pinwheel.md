# Plan: postgres.js → pg (node-postgres) + Hyperdrive 対応

## Context

`apps/api` (Hono) を Cloudflare Workers にデプロイするため、PostgreSQL接続に Hyperdrive を使用する。Hyperdrive の公式推奨ドライバは `pg` (node-postgres)。現在の `postgres.js` + `drizzle-orm/postgres-js` から `pg` + `drizzle-orm/node-postgres` に移行する。ローカル開発は `wrangler dev` に統一し、dotenvx で暗号化された環境変数を扱う。

## 変更ファイル一覧

| ファイル                              | 操作                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `apps/api/package.json`               | 依存関係の変更、dev script の変更                            |
| `apps/api/wrangler.jsonc`             | 新規作成                                                     |
| `apps/api/src/shared/db/index.ts`     | DB接続を pg + Hyperdrive に変更                              |
| `apps/api/src/shared/db/rls.ts`       | `getDb(c)` を async 呼び出しに変更                           |
| `apps/api/src/shared/types/hono.d.ts` | Hono Bindings 型を追加                                       |
| `apps/api/src/index.ts`               | Hono に Bindings 型を適用、DB クリーンアップミドルウェア追加 |

## 手順

### 1. 依存関係の変更 (`apps/api/package.json`)

**dependencies:**

- `"postgres": "^3.4.8"` → 削除
- `"pg": "^8.13.0"` → 追加

**devDependencies:**

- `"@types/pg": "^8.11.0"` → 追加

**scripts:**

- `"dev": "dotenvx run -- bun run --hot src/index.ts"` → `"dev": "wrangler dev"`

### 2. wrangler.jsonc の新規作成 (`apps/api/wrangler.jsonc`)

```jsonc
{
	"name": "otography-api",
	"main": "src/index.ts",
	"compatibility_flags": ["nodejs_compat"],
	"compatibility_date": "2026-03-24",
	"hyperdrive": [
		{
			"binding": "HYPERDRIVE",
			"id": "", // wrangler hyperdrive create で取得
			"localConnectionString": "", // ローカル開発用の DATABASE_URL
		},
	],
}
```

- `localConnectionString`: `wrangler dev` 時に `env.HYPERDRIVE.connectionString` として利用される
- 本番: Hyperdrive ID で管理されたコネクションプールを使用

### 3. Hono Bindings 型の定義 (`apps/api/src/shared/types/hono.d.ts`)

```typescript
import "hono";
import type { DecodedIdToken } from "firebase-admin/auth";

declare module "hono" {
	interface ContextVariableMap {
		authSession: {
			claims: DecodedIdToken;
			sessionCookie: string;
		} | null;
		jwtPayload: DecodedIdToken | null;
		userId: string | null;
	}

	interface Bindings {
		HYPERDRIVE: Hyperdrive;
		DATABASE_URL: string;
		AUTH_COOKIE_DOMAIN?: string;
		APP_FRONTEND_URL: string;
		FIREBASE_API_KEY: string;
		FIREBASE_CLIENT_EMAIL: string;
		FIREBASE_PRIVATE_KEY: string;
		FIREBASE_PROJECT_ID: string;
		PORT?: string;
		NODE_ENV?: "development" | "production" | "test";
	}
}
```

### 4. Hono アプリケーションの型適用 (`apps/api/src/index.ts`)

```typescript
type Bindings = Hono["Bindings"]; // hono.d.ts で定義した型

const app = new Hono<{ Bindings: Bindings }>();
```

DB クリーンアップミドルウェアを追加（`authSessionMiddleware()` の前に配置）:

```typescript
import { dbCleanupMiddleware } from "./shared/db";

app.use("*", dbCleanupMiddleware());
```

### 5. DB接続の変更 (`apps/api/src/shared/db/index.ts`)

**変更点:**

- `postgres` → `pg` (Client)
- `drizzle-orm/postgres-js` → `drizzle-orm/node-postgres`
- シングルトンパターンを廃止 → リクエストごとに新しい Client を作成（Hyperdrive がコネクションプールを管理）
- 常に `env.HYPERDRIVE.connectionString` を使用（`wrangler dev` でも Hyperdrive binding が利用可能）

```typescript
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Context, Next } from "hono";
import { profiles } from "./schema";

export const getDb = async (c: Context) => {
	const client = new Client({
		connectionString: c.env.HYPERDRIVE.connectionString,
	});
	await client.connect();

	c.set("__pg_client", client);
	return drizzle(client, { schema: { profiles } });
};

export const dbCleanupMiddleware = () => async (c: Context, next: Next) => {
	await next();
	const client = c.get("__pg_client");
	if (client) {
		await client.end();
	}
};
```

### 6. rls.ts の更新 (`apps/api/src/shared/db/rls.ts`)

`getDb(c)` が async になったため `await` を追加:

```typescript
// 変更前
const db = getDb(c);
// 変更後
const db = await getDb(c);
```

## 影響しないファイル

- `apps/api/src/shared/db/schema.ts` — `drizzle-orm/pg-core` はそのまま
- `apps/api/src/features/auth/route.ts` — `withRls()` は既に async、変更不要
- `apps/api/drizzle.config.ts` — Drizzle Kit CLI は Hyperdrive を経由せず直接 `DATABASE_URL` で接続（CLIはWorkers外で実行）
- `apps/api/src/env.ts` — 文字列環境変数のバリデーションはそのまま（Hyperdrive binding は `c.env` から直接アクセス）

## 検証

1. `bun install` — 依存関係の更新
2. `cd apps/api && bun run check-types` — 型チェック通過
3. `cd apps/api && bun run db:push` — Drizzle Kit が直接 DATABASE_URL で接続し正常動作
4. `cd apps/api && bun run dev` — `wrangler dev` が起動し、既存の API エンドポイントが正常動作
