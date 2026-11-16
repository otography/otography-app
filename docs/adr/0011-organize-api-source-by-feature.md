# API のソースは、機能ごとのフォルダに分けて置く

`apps/api/src` のファイルは、層（ルート、処理、スキーマ）ごとではなく、機能（認証、ユーザー、曲など）ごとのフォルダに分けて置く。どの機能にも属さないもの（環境変数の読み込み、DB への接続）は `lib/` に置く。`src/` の直下には、各機能のルートをつなぐ `index.ts` だけを置く。1 つの機能を変更するときに読み書きするファイルを、1 つのフォルダに集めるためである。

## 前提

- これから、投稿、お気に入り、プロフィール、通報、管理者の操作の API を追加する。
- 1 つの機能は、ルート、処理（DB や外部の API を使うもの）、入出力のスキーマ、テストからなる。
- 2026-11-17 の時点では、`src/` の直下に `auth.ts`、`db.ts`、`env.ts`、`songs.ts`、`index.ts` があり、セッションのミドルウェアは `middleware/`、`/api/me` のスキーマは `schemas/`、Apple Music の処理は `apple-music/` にあった。すべてのルートは `index.ts` に直接書いていた。

## 理由

### 1. 層ごとに分けると、1 つの機能の変更が複数のフォルダにまたがる

- 層ごとのフォルダ（`routes/`、`services/`、`schemas/`）にすると、たとえば投稿の API を変更するときに、3 つのフォルダのファイルを開く必要がある。
- 機能ごとのフォルダにすると、変更するファイルは 1 つのフォルダに収まる。機能を追加するときは、フォルダを 1 つ作り、`index.ts` に 1 行を足す。

### 2. ルートを 1 つのファイルに書き続けると、ファイルが機能の数に比例して長くなる

- Hono のドキュメント（「Building a larger application」）は、機能ごとに `new Hono()` でルートを作り、`app.route()` でつなぐ形を示している。
- 各ファイルでメソッドをつなげて書けば、`app.route()` でつないだ後も、`hc` のクライアントが使う型（`AppType`）は推論される。

## 実装

```
src/
  index.ts                  … 各機能のルートを app.route() でつなぐ
  lib/
    env.ts                  … requireEnv
    db.ts                   … Turso への接続
  auth/
    auth.ts                 … Better Auth のインスタンス
    session.ts              … sessionMiddleware、requireAuth
  users/
    routes.ts               … GET /api/me
    schemas.ts              … meSchema
  songs/
    routes.ts               … GET /api/music/token
    find-or-fetch.ts        … findOrFetchSong
    apple-music/
      token.ts、catalog.ts  … Apple Music API の開発者トークンとカタログの取得
```

- 機能のフォルダには、必要に応じて `routes.ts`（ルート）、`schemas.ts`（入出力のスキーマ）、処理のファイルを置く。処理のファイルには、処理の内容を表す名前（`find-or-fetch.ts` など）を付ける。
- テストは `apps/api/tests` の下に、`src` と同じフォルダ構成で置く（例：`tests/songs/find-or-fetch.test.ts`）。
- `/api/auth/*` と `sessionMiddleware` は、すべてのルートの前に適用する必要があるので、`index.ts` に書く。

## 検討した他の案

- **層ごとのフォルダ（`routes/`、`services/`、`schemas/`）**：理由 1 のとおり、1 つの機能の変更が複数のフォルダにまたがるので、採用しない。
- **`src/` の直下にファイルを置き続ける**：機能を追加するたびに直下のファイルが増え、どのファイルがどの機能に属するかを、ファイル名だけで判断する必要があるので、採用しない。

## この決定による影響

- 2 つ以上の機能が使う処理（たとえば、投稿とお気に入りの両方が使う `findOrFetchSong`）は、その処理が扱うデータの機能のフォルダに置き、他の機能のフォルダから読み込む。
- フォルダを移したので、ADR の中のファイルのパスも新しいパスに書き換えた。
