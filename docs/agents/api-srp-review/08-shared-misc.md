# 08 — shared/middleware, logging, pagination, types, apple-music SRPレビュー

**対象ファイル**（19ファイル）:

- `middleware/` (5ファイル): auth, csrf, db, index, rate-limit
- `logging/` (2ファイル): redaction, structured-log
- `pagination/` (6ファイル): helpers, index, query, schema, types, validator
- `types/` (2ファイル): bindings, env
- `apple-music/` (4ファイル): client, index, to-song-input, token

## 結果サマリー

| ファイル                            | SRP | 合成性 |
| ----------------------------------- | --- | ------ |
| middleware/auth.middleware.ts       | ⚠️  | ✅     |
| middleware/csrf.middleware.ts       | ✅  | ✅     |
| middleware/db.middleware.ts         | ✅  | ✅     |
| middleware/index.ts                 | ✅  | ✅     |
| middleware/rate-limit.middleware.ts | ⚠️  | ✅     |
| logging/redaction.ts                | ⚠️  | ✅     |
| logging/structured-log.ts           | ✅  | ✅     |
| pagination/helpers.ts               | ⚠️  | ✅     |
| pagination/index.ts                 | ✅  | ✅     |
| pagination/query.ts                 | ✅  | ✅     |
| pagination/schema.ts                | ✅  | ✅     |
| pagination/types.ts                 | ✅  | ✅     |
| pagination/validator.ts             | ✅  | ✅     |
| types/bindings.ts                   | ✅  | ✅     |
| types/env.ts                        | ✅  | ✅     |
| apple-music/client.ts               | ✅  | ✅     |
| apple-music/index.ts                | ✅  | ⚠️     |
| apple-music/to-song-input.ts        | ✅  | ✅     |
| apple-music/token.ts                | ✅  | ✅     |

**総評**: 全体的にSRP・合成性ともに高く設計されている。errore convention、型駆動のスキーマ定義、モジュール境界の分離が一貫している。⚠️ の項目はいずれも軽微で、現在の構成でも実用上問題ないレベル。pagination/ ディレクトリは6ファイルへの適切な分割がされており、特に評価が高い。

## 詳細（問題のあるファイルのみ）

### `middleware/auth.middleware.ts` ⚠️

**問題点**:

- 3つのミドルウェア（`authSessionMiddleware` / `requireAuthMiddleware` / `requireFreshSessionMiddleware`）を1ファイルに集約
- `requireFreshSessionMiddleware`（行66-100）が `authSessionMiddleware` と同様のCookie検証・セッション再解決フローを繰り返す
- ただし既存の設計意図（#7「認証バイパスを許さない」ための明示的な再検証）としては妥当

**推奨**（軽微）:

- 重複ロジック（Cookie処理やエラーハンドリング）を `handleSessionError(c, resolved)` のような小ヘルパーに抽出し、`requireFreshSessionMiddleware` の本質的な「strict再検証」責務を際立たせる

---

### `middleware/rate-limit.middleware.ts` ⚠️

**問題点**:

- `getRateLimiter`（行9-21）が「バインディングの取得・検証」という独立した責務を持つが、ミドルウェアファイル内にインライン定義
- `RateLimiterBinding` インターフェース（行8）も同様

**推奨**（軽微）:

- `getRateLimiter` を `bindings.ts` または `../types/bindings.ts` 内のヘルパーに切り出す

---

### `logging/redaction.ts` ⚠️

**問題点**:

- 2つの異なる関数が1ファイルにある:
  - `maskIdentifier` — ID秘匿化
  - `errorLogFields` — エラーオブジェクトからログフィールド抽出
- ファイル名 `redaction.ts` だが `errorLogFields` は厳密にはリダクションではなく「ログ向け抽出」で、命名と内容が若干ミスマッチ

**推奨**（軽微）:

- ファイル名を `log-format.ts` 等に変更するか、関数を目的別に分離

---

### `pagination/helpers.ts` ⚠️

**問題点**:

- `normalizeLimit` と `buildPaginationMeta`/`trimItems`/`createPage` の2つのサブ責務
- ただし全体として「ページネーション計算」の統一された責務の下にあるため、分離必須ではない

**推奨**: なし（現在の構成で妥当）。

---

### `types/env.ts` ✅（軽微な所見）

**問題点**:

- `ResolvedSessionContext` 型（行4-9）が認証ミドルウェアの実装詳細を `types/env.ts` が知っている。理想的には `auth` モジュール側で定義すべき。

**推奨**（軽微）:

- `ResolvedSessionContext` を `shared/auth/` 側に移動し、`env.ts` はそれをインポートする形にする

---

### `apple-music/index.ts` ✅（軽微な所見）

**問題点**:

- `token.ts` の `generateDeveloperToken` / `generateWebDeveloperToken` がバレルに含まれていない
- 意図的（内部利用限定）かもしれないが、`apple-music/token` ルートがこれらを別途インポートしている場合、パスを知る必要がある

**推奨**:

- 外部から使用されるならバレルに追加。内部限定なら現状で問題なし。
