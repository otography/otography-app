# Better Auth のインスタンスを、リクエストごとではなくモジュールの最上位で 1 回だけ作る

`apps/api/src/auth.ts` は、Better Auth のインスタンス（`betterAuth()` の戻り値）をモジュールの最上位で 1 回だけ作り、同じ isolate が受けるすべてのリクエストで使い回す。インスタンスが使う環境変数とシークレットは、Hono の `c.env` からではなく `process.env` から読む。この形を選んだ理由は 2 つある。1 つ目は、リクエストごとに作ると、インスタンスを作る処理の CPU 時間をすべてのリクエストで使うことである。2 つ目は、Better Auth の公式の Cloudflare ガイドがこの形を示していることである。

## 前提

- Workers の無料プランでは、1 リクエストが使える CPU 時間は 10ms までである。
- `betterAuth()` は、呼ばれたときに設定を組み立て、エンドポイントを準備する。この処理には CPU 時間がかかる。ただし、何 ms かかるかはまだ測っていない。
- Workers は、同じ isolate で複数のリクエストを処理する。モジュールの最上位のコードは、isolate ごとに 1 回だけ実行される。
- Worker の互換日付は 2026-11-13 である。Cloudflare のドキュメントによると、互換日付が 2025-04-01 以降の Worker では、変数とシークレットが `process.env` に入る。Better Auth の Cloudflare ガイドによると、互換日付が 2026-08-04 以降の Worker では、Node.js 互換が既定で有効になる。
- DB には、HTTP で問い合わせる libSQL の web 版クライアントで接続する。

## 理由

### 1. リクエストごとに作ると、インスタンスを作る処理の CPU 時間をすべてのリクエストで使う

- リクエストごとに作る形では、`betterAuth()` と DB クライアントを作る処理がリクエストのたびに実行される。
- モジュールの最上位で作る形では、この処理は isolate ごとに 1 回だけ実行される。2 回目以降のリクエストは、この処理の CPU 時間を使わない。
- CPU 時間の上限は 1 リクエスト 10ms なので、すべてのリクエストで使う処理は少ないほうがよい。

### 2. Better Auth の公式の Cloudflare ガイドが、この形を示している

- Better Auth の Cloudflare ガイド（https://www.better-auth.com/docs/guides/cloudflare ）は、インスタンスをモジュールの最上位で作り、値を `process.env` から読む書き方を示している。
- 同じガイドは、モジュールの最上位で作るインスタンスには、接続を開いたまま保持するクライアント（`pg` や `mysql2` の接続プールなど）を持たせられないと書いている。Workers はリクエストをまたいだ I/O を許さないからである。この ADR の形では、DB クライアントに HTTP で問い合わせる libSQL の web 版クライアントを使うので、この制約に当たらない。

## 検討した他の案

- **リクエストごとに、`c.env` を受け取る関数でインスタンスを作る**：Hono の「Better Auth on Cloudflare」の例（https://hono.dev/examples/better-auth-on-cloudflare ）の形である。理由 1 のとおり、インスタンスを作る処理の CPU 時間をすべてのリクエストで使うので、採用しない。ただし、この案には下の「この決定による影響」の 1 つ目の問題が無いという利点がある。なお、この例は Better Auth の古いアダプター（`better-auth/adapters/drizzle`）と古い CLI（`@better-auth/cli`）を使っている。

## この決定による影響

- Cloudflare のドキュメント（https://developers.cloudflare.com/workers/runtime-apis/bindings/ ）によると、コードを変えずにバインディング（シークレットを含む）だけを変えてデプロイした場合、Cloudflare は動いている isolate を使い続けることがある。その場合、古いシークレットで作ったインスタンスが残る。そのため、シークレットを変えた後は、コードを含めてデプロイし直す。
- API のコードは、環境変数とシークレットを `process.env` から読む（`apps/api/src/env.ts` の `requireEnv`）。
- `cloudflare.config.ts` で `bindings.secret()` を 1 つでも宣言すると、宣言していない `.env` の値は Worker に渡らない（2026-11-16 のローカル検証で、宣言していなかった `BETTER_AUTH_URL` が渡らなかった）。環境変数を追加するときは、`cloudflare.config.ts` にも宣言する。
- Better Auth の CLI（`auth check schema` など）は、`apps/api/src/auth.ts` をそのまま読める。CLI は Node で動くので、`process.env` から値を読む書き方であれば、Workers 専用のモジュールを読み込まずに済むからである。
- インスタンスを作る処理の CPU 時間は、デプロイした後に測る。10ms に収まらない場合は、この決定を見直す。
