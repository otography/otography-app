# プルリクエストで PR ごとの Preview に、main へのマージで本番に、GitHub Actions から反映する

プルリクエストを開くかコミットを足すと、GitHub Actions が staging の DB にマイグレーションを適用し、Worker の PR ごとの Preview（`pr-<PR番号>`）にデプロイして、その URL をプルリクエストにコメントする。プルリクエストを閉じる（またはマージする）と、その Preview を削除する。main にマージすると、本番の DB にマイグレーションを適用し、本番の Worker「app」にデプロイする。手元からのデプロイでは、マイグレーションの適用漏れや、マージしていないコードの本番への反映が起こりうるからである。

## 前提

- 設計ドキュメントでは、デプロイを GitHub Actions が受け持つと決めている。
- Worker の Preview は PR ごと（`pr-<PR番号>`）に作り、URL の解決と Google ログインは ADR 0008 の `allowedHosts`（`*-app.otography.workers.dev`）と `oAuthProxy` で対応する。
- 新しく作られる Preview にシークレットを自動継承するため、Cloudflare の Worker 設定（Previews Base）に staging 用のシークレットを登録しておく。
- DB は staging の Turso と D1（`x-store-staging-01`）の 1 組を全 Preview で共有する。
- `cf` は、CI では `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` で認証する。また、CI では、確認が必要な操作を中断し、終了コード 0 で終わる（Cloudflare の「Use cf in CI」）。
- Vite+ は、GitHub Actions では `voidzero-dev/setup-vp` で導入する（Vite+ の「Continuous Integration」）。

## 理由

### 1. マイグレーションとデプロイを同じ手順で行うと、適用漏れが起きない

- これまでは、手元でマイグレーションとデプロイを別々に実行していた。どちらかを忘れると、コードと DB の定義が食い違う。
- ワークフローでは、マイグレーションを適用してからデプロイするので、新しいコードが古い定義の DB を使うことはない。

### 2. 本番に反映されるのは main にマージしたコードだけになる

- 手元からのデプロイでは、マージしていないブランチのコードを本番に反映できてしまう。
- 本番へのデプロイを main への push だけで行うと、本番のコードは常に main のコードと同じになる。

### 3. Preview を PR ごとに分けると、並行する PR が互いの環境を上書きしない

- 単一の `staging` Preview を共有すると、複数のプルリクエストを同時に進めているときに、後から push した PR が別の PR の確認環境を上書きしてしまう。
- Preview 名を `pr-<PR番号>` に分けることで、各 PR が独立した URL（`pr-<PR番号>-app.otography.workers.dev`）で確認できる。

## 実装

- `.github/workflows/staging.yml`：`pull_request`（main 向け）で動く。`verify`（`typecheck`、`vp check`、`vp test`、`knip`）、`migrate`（staging の DB へのマイグレーション）、`deploy`（`PREVIEW_NAME=pr-<PR番号>` で `deploy:preview`、URL のコメント）の順に行う。フォークからのプルリクエストでは動かさない（シークレットを渡さないため）。
  - `verify` は PR ごとに並列実行し、新しい push が来たら古い実行を取り消す（`cancel-in-progress: true`）。
  - `migrate` は staging DB が 1 つなので `concurrency.group: staging-db` で直列実行し、途中で取り消さない。
  - `deploy` は `concurrency.group: preview-deploy-pr-<PR番号>` で PR ごとに並列実行する。
- `.github/workflows/preview-cleanup.yml`：`pull_request` の `closed` で動き、対応する `pr-<PR番号>` の Preview を `delete:preview` で削除する。デプロイと競合しないよう `preview-deploy-pr-<PR番号>` と同じ concurrency group を使う。
- `.github/workflows/production.yml`：main への `push` で動く。`vp check` と `vp test` の後、本番の DB へのマイグレーション、`deploy` の順に行う。デプロイの出力に「Deploy complete」がなければ失敗にする。`cf` が CI で操作を中断しても、終了コード 0 で終わるからである。`concurrency` で 1 つずつ実行し、実行中のものを取り消さない。
- シークレットは、GitHub の Environment（`staging` と `production`）ごとに登録する。名前は両方で同じにする。
  - `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
  - `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`（Environment ごとに、その環境の DB の値）

## 検討した他の案

- **手元からデプロイし続ける**：理由 1 と 2 のとおり、適用漏れと、マージしていないコードの反映が起こりうるので、採用しない。
- **単一の `staging` Preview を使い回す**：複数の PR を並行で進めると確認環境が上書きし合うため、PR ごとの Preview に変更した。
- **プルリクエストごとに別の DB（Turso ブランチ）も作る**：無料プランの Turso はグループが 1 つで、DB を増やすと管理の手間が増えるので、採用しない。

## この決定による影響

- staging の DB は全 Preview で共有されるため、マージしていないプルリクエストのマイグレーションも適用される。マイグレーションは元に戻せないので、プルリクエストを閉じても、staging の DB の定義は戻らない。また、マイグレーションを含むプルリクエストを 2 つ同時に開くと、staging の DB の定義が、どちらの main とも違う状態になりうる。その場合は、staging の DB を作り直す。
- Cloudflare の Worker 設定で **Previews Base** にシークレットが登録されていないと、新しく作られた `pr-<PR番号>` の Preview にシークレットが渡らない。
- 手元からの `deploy`、`deploy:staging`、`deploy:preview`、`delete:preview` は、ワークフローが動かない場合の予備として残す。
