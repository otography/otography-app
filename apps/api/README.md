# API (Hono + Supabase + Drizzle)

Supabase の公式 Hono 認証サンプルに合わせた API サーバーです。

## セットアップ

### 1. 環境変数

`.env` を作成し、以下を設定します。

```env
# Supabase
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Server
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

API は `http://localhost:3001` で起動します。

## 認証ミドルウェア

`src/middleware/auth.middleware.ts` の `supabaseMiddleware` を全ルートへ適用しています。

```ts
app.use("*", supabaseMiddleware());
```

ルート内では `getSupabase(c)` で Supabase クライアントを取得します。

## エンドポイント

### `GET /`

ヘルスチェック用のシンプルな応答。

### `GET /api/user`

`supabase.auth.getClaims()` でログイン状態を返します。

- 未ログイン: `{ "message": "You are not logged in." }`
- ログイン済み: `{ "message": "You are logged in!", "userId": "..." }`

### `GET /signout`

`supabase.auth.signOut()` 実行後、`/` へリダイレクトします。

### `GET /countries`

RLS 有効テーブルの取得例です。

```ts
const { data, error } = await supabase.from("countries").select("*");
```

## Drizzle コマンド

```bash
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

## 公式サンプル

ベースにしたサンプル:

- https://github.com/supabase/supabase/blob/4d967740f73fd5bf8af9ae9c26afacc0c24149db/examples/auth/hono/src/index.tsx
