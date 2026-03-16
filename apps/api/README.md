# API (Hono + Drizzle + Supabase)

BFF (Backend For Frontend) 構成の API サーバー。

## セットアップ

### 1. Supabase ローカル環境の起動

```bash
# Supabase CLI のインストール（未インストールの場合）
brew install supabase/tap/supabase

# 初期化（初回のみ）
supabase init

# ローカル環境の起動
supabase start
```

起動後、表示される接続情報を `.env` に設定：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
PORT=3001
APP_FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 2. 依存関係のインストール

```bash
bun install
```

### 3. 開発サーバーの起動

```bash
bun run dev
```

http://localhost:3001 で起動します。

## DB スキーマの追加

### 1. スキーマ定義

`src/db/schema.ts` にテーブルを定義：

```ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
```

### 2. マイグレーション生成 & 適用

```bash
# マイグレーションファイル生成
bun run db:generate

# DB に適用
bun run db:push
```

## 利用可能なスクリプト

| コマンド | 説明 |
|---------|------|
| `bun run dev` | 開発サーバー起動（ホットリロード） |
| `bun run db:generate` | マイグレーションファイル生成 |
| `bun run db:push` | スキーマをDBに直接プッシュ（開発用） |
| `bun run db:studio` | Drizzle Studio 起動（DB GUI） |

## API エンドポイントの追加

`src/index.ts` にルートを追加：

```ts
import { Hono } from "hono";
import { db } from "./db";
import { photos } from "./db/schema";

const app = new Hono();

app.get("/photos", async (c) => {
  const allPhotos = await db.select().from(photos);
  return c.json({ data: allPhotos });
});

export default app;
```

## Hono RPC（フロントエンド連携）

フロントエンドと型を共有する場合：

1. API 側で型をエクスポート：

```ts
export type AppType = typeof app;
```

2. フロントエンドで型付きクライアントを作成：

```ts
import { hc } from "hono/client";
import type { AppType } from "api";

const client = hc<AppType>("http://localhost:3001");
const res = await client.photos.$get();
```

## 将来的な Supabase リプレースについて

この構成では、Supabase への依存を Drizzle ORM レイヤーで抽象化しています。
将来的に Supabase を別の DB に置き換える場合：

1. 新しい DB の接続情報を `DATABASE_URL` に設定
2. `drizzle-kit push` でスキーマを適用
3. コードの変更は不要（ORM が吸収）
