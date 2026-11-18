# otography

曲への短い感想を投稿し、ほかの人の音楽体験に触れる SNS。

- `apps/website`：画面（Vite + React、TanStack Router）
- `apps/api`：API（Hono、Cloudflare Workers）
- `packages/db`：DB のスキーマとマイグレーション（Turso / libSQL、Drizzle ORM）

## ローカルでの始め方

### 1. 必要なもの

- Node.js 22.18 以上と [Vite+](https://viteplus.dev/)（`vp`）
- Turso CLI：`brew install tursodatabase/tap/turso`

```bash
vp install
```

### 2. DB を起動して、表とダミーのデータを入れる

DB は、ターミナルを 1 つ使って起動したままにする。

```bash
turso dev --db-file local.db   # http://127.0.0.1:8080 で待ち受ける。トークンは要らない
```

別のターミナルで、表を作り、ダミーのデータを入れる。

```bash
vp run db#db:migrate   # マイグレーションを当てる
vp run db#db:seed      # ダミーのユーザー 3 人、曲 4 曲、投稿 6 件、いいね、お気に入りを入れる
```

- どちらも、`TURSO_DATABASE_URL` が無ければ `http://127.0.0.1:8080` を使う
- `db:seed` は、何度実行しても同じ行を二重には入れない。ローカル以外の URL では実行を止める
- ダミーのユーザーはログインできない。自分でログインしてから、`/u/seed-aoi` などを開いて投稿やいいねを試す
- DB を作り直すときは、`turso dev` を止めて `local.db` を消し、上の手順をやり直す

### 3. API の設定（`apps/api/.env`）

```bash
cp apps/api/.env.example apps/api/.env
```

`.env` に入れる値と、その作り方は `.env.example` のコメントにある。

- `BETTER_AUTH_SECRET`：`openssl rand -base64 32` で作る
- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：Google でログインするための OAuth クライアント。承認済みのリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を入れる
- `APPLE_TEAM_ID`、`APPLE_KEY_ID`、`APPLE_MUSIC_PRIVATE_KEY`：曲を検索するための Apple Music の鍵
- `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`：`.env.example` のまま（ローカルの DB を使う）

`.env` は Git に入れない。ステージングと本番の値（`.env.staging`、`.env.production`）は、ローカルの開発には使わない。

### 4. 起動する

API と画面を、それぞれ別のターミナルで起動する。

```bash
vp run api#dev   # API（http://localhost:8787）
vp run dev       # 画面（http://localhost:3000）。/api への問い合わせは API に送る
```

http://localhost:3000 を開き、Google でログインする。

### 管理者の画面を試す

管理者かどうかは API からは変えられず、DB で設定する（`docs/adr/0018-admin-flag-in-users.md`）。自分の公開 ID（プロフィールの URL の `/u/` の後ろ）を入れて実行する。

```bash
turso db shell http://127.0.0.1:8080 "update users set is_admin = 1 where public_id = '<公開 ID>'"
```

## 開発のコマンド

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Detect duplicate code with [similarity-ts](https://github.com/mizchi/similarity) (requires `cargo install similarity-ts`):

```bash
vp run similarity     # report (threshold 0.85, includes experimental overlap detection)
vp run similarity:ci  # fail on near-exact duplicates (threshold 0.95)
```

- Run the development server:

```bash
vp run dev
```
