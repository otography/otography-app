# プルリクエストで staging に、main へのマージで本番に、GitHub Actions から反映する

プルリクエストを開くかコミットを足すと、GitHub Actions が staging の DB にマイグレーションを適用し、Worker の Preview「staging」にデプロイして、その URL をプルリクエストにコメントする。main にマージすると、本番の DB にマイグレーションを適用し、本番の Worker「app」にデプロイする。手元からのデプロイでは、マイグレーションの適用漏れや、マージしていないコードの本番への反映が起こりうるからである。

## 前提

- 設計ドキュメントでは、デプロイを GitHub Actions が受け持つと決めている。
- staging は Worker の Preview「staging」と staging の Turso の DB の 1 組だけである（ADR 0008）。
- `cf` は、CI では `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` で認証する。また、CI では、確認が必要な操作を中断し、終了コード 0 で終わる（Cloudflare の「Use cf in CI」）。
- Vite+ は、GitHub Actions では `voidzero-dev/setup-vp` で導入する（Vite+ の「Continuous Integration」）。

## 理由

### 1. マイグレーションとデプロイを同じ手順で行うと、適用漏れが起きない

- これまでは、手元でマイグレーションとデプロイを別々に実行していた。どちらかを忘れると、コードと DB の定義が食い違う。
- ワークフローでは、マイグレーションを適用してからデプロイするので、新しいコードが古い定義の DB を使うことはない。

### 2. 本番に反映されるのは main にマージしたコードだけになる

- 手元からのデプロイでは、マージしていないブランチのコードを本番に反映できてしまう。
- 本番へのデプロイを main への push だけで行うと、本番のコードは常に main のコードと同じになる。

## 実装

- `.github/workflows/staging.yml`：`pull_request`（main 向け）で動く。`vp check` と `vp test` の後、staging の DB へのマイグレーション、`deploy:staging`、URL のコメント（`gh pr comment --edit-last --create-if-none`）の順に行う。フォークからのプルリクエストでは動かさない（シークレットを渡さないため）。
- `.github/workflows/production.yml`：main への `push` で動く。`vp check` と `vp test` の後、本番の DB へのマイグレーション、`deploy` の順に行う。デプロイの出力に「Deploy complete」がなければ失敗にする。`cf` が CI で操作を中断しても、終了コード 0 で終わるからである。
- どちらも `concurrency` で 1 つずつ実行し、実行中のものを取り消さない。マイグレーションを途中で止めないためである。
- シークレットは、GitHub の Environment（`staging` と `production`）ごとに登録する。名前は両方で同じにする。
  - `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
  - `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`（Environment ごとに、その環境の DB の値）

## 検討した他の案

- **手元からデプロイし続ける**：理由 1 と 2 のとおり、適用漏れと、マージしていないコードの反映が起こりうるので、採用しない。
- **プルリクエストごとに別の Preview と DB を作る**：無料プランの Turso はグループが 1 つで、DB を増やすと管理の手間が増えるので、採用しない。

## この決定による影響

- staging の DB には、マージしていないプルリクエストのマイグレーションも適用される。マイグレーションは元に戻せないので、プルリクエストを閉じても、staging の DB の定義は戻らない。また、マイグレーションを含むプルリクエストを 2 つ同時に開くと、staging の DB の定義が、どちらの main とも違う状態になりうる。その場合は、staging の DB を作り直す。
- 手元からの `deploy` と `deploy:staging` は、ワークフローが動かない場合の予備として残す。
