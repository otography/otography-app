# アプリの URL をリクエストのホスト名から決め、Preview のログインは oAuthProxy で本番を経由させる

Better Auth の `baseURL` には固定の URL ではなく `allowedHosts` を指定し、アプリの URL をリクエストのホスト名から決める。また、Preview での Google ログインは、Better Auth の `oAuthProxy` プラグインで本番を経由させる。Preview の URL は Preview ごとに変わるが、Google にはリダイレクト URI を 1 つずつ完全一致の形で登録する必要があるからである。

## 前提

- Worker は本番の `app` の 1 つだけであり、ステージングや PR ごとの確認環境は、その Worker の Preview として作る。
- workers.dev の URL は、本番が `app.otography.workers.dev`、Preview が `<Preview 名>-app.otography.workers.dev` である（Cloudflare の Previews のドキュメント）。
- `cloudflare.config.ts` を読み込む時点では、Preview かどうか（`isPreview`）は分かるが、Preview の名前は分からない。
- Google の OAuth クライアントには、リダイレクト URI を完全一致の形で登録する必要がある。

## 理由

### 1. URL を固定すると、Preview の名前ごとに正しい URL を作れない

- `BETTER_AUTH_URL` を `cloudflare.config.ts` で決める形では、Preview の名前が分からないので、すべての Preview が同じ URL（たとえば `staging-app.otography.workers.dev`）を使うことになる。その場合、`staging` 以外の Preview では、ログインの戻り先が別の Preview になる。
- `allowedHosts` を指定すると、Better Auth はリクエストのホスト名からアプリの URL を決める。許可していないホスト名のときは `fallback`（本番の URL）を使う。

### 2. Preview ごとに Google へリダイレクト URI を登録するのは現実的ではない

- `oAuthProxy` を使うと、Preview のログインでは Google に本番の戻り先が伝えられる。本番が Google とのやりとりを済ませ、プロフィールを暗号化して Preview に送り返し、Preview が自分の DB にユーザーとセッションを作る（Better Auth の OAuth Proxy のドキュメント）。
- そのため、Google には本番のリダイレクト URI だけを登録すればよい。

## 実装

- `apps/api/src/auth/auth.ts`
  - `baseURL`：`allowedHosts` は `app.otography.workers.dev`、`*-app.otography.workers.dev`、`localhost:3000`。`fallback` は本番の URL。
  - `plugins`：`OAUTH_PROXY_SECRET` が設定された環境（本番と Preview）だけで `oAuthProxy` を有効にする。ローカルでは設定しないので、ローカルは自分のリダイレクト URI（`http://localhost:3000/api/auth/callback/google`）で直接ログインする。ローカルのログインを本番に頼らないためである。
- `apps/website/vite.config.ts`：開発サーバーのプロキシで `changeOrigin: false` を指定する。Vite のプロキシを文字列で書くと `Host` ヘッダーが `localhost:8787` に書き換わり、ローカルなのに本番の URL が使われたからである（2026-11-17 に確認）。

## 検討した他の案

- **Preview の URL を `staging` に固定し、Google にはステージングの URI を追加する**：`staging` 以外の Preview でログインできないので、採用しない。
- **Preview を作るたびに、Google にリダイレクト URI を追加する**：手作業が Preview の数だけ増えるので、採用しない。

## この決定による影響

- `OAUTH_PROXY_SECRET` は、本番と Preview で同じ値にする。Better Auth のドキュメントによると、この値を持つ環境は、誰としてでもログインさせることができる。外部の人のコードが動く Preview には、この値を渡してはならない。
- 本番と、ログインに参加するすべての Preview は、Better Auth を同じ版にそろえる必要がある。版が違う環境同士では、暗号化したデータをやりとりできない（Better Auth のドキュメント）。
- Preview でのログインは、本番が動いていないとできない。
- `allowedHosts` の `*` はドットもまたぐので、`a.b-app.otography.workers.dev` のようなホスト名も許可される。`otography.workers.dev` の下の名前はこのアカウントの Worker にしか付かないので、他人がこの名前を使うことはできない。
- 2026-11-17 に、ホスト名ごとの戻り先を確かめた。本番は本番の URL、Preview（`oAuthProxy` が有効なとき）は本番の URL、ローカルは `localhost:3000`、許可していないホスト名は本番の URL だった。Preview での実際のログインは、まだ確かめていない。
