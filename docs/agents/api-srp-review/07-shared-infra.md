# 07 — shared/db, errors, firebase SRPレビュー

**対象ファイル**（12ファイル）:

- `db/index.ts`, `db/postgres-error.ts`, `db/rls.ts`, `db/schema.ts`
- `errors/domain-error.ts`, `errors/error-registry.ts`, `errors/error-response.ts`, `errors/global-error-handler.ts`
- `firebase/firebase-admin.ts`, `firebase/firebase-google.ts`, `firebase/firebase-rest.ts`, `firebase/firebase-token-exchange.ts`

## 結果サマリー

| ファイル                            | SRP | 合成性 |
| ----------------------------------- | --- | ------ |
| db/index.ts                         | ✅  | ✅     |
| db/postgres-error.ts                | ✅  | ✅     |
| db/rls.ts                           | ✅  | ✅     |
| db/schema.ts                        | ⚠️  | ⚠️     |
| errors/domain-error.ts              | ✅  | ✅     |
| errors/error-registry.ts            | ⚠️  | ✅     |
| errors/error-response.ts            | ⚠️  | ✅     |
| errors/global-error-handler.ts      | ✅  | ✅     |
| firebase/firebase-admin.ts          | ✅  | ✅     |
| firebase/firebase-google.ts         | ⚠️  | ✅     |
| firebase/firebase-rest.ts           | ✅  | ✅     |
| firebase/firebase-token-exchange.ts | ✅  | ✅     |

**総評**: いずれのファイルも「合成可能性」は高く、既存の小関数への分解が適切にできている。改善余地はSRPの観点でファイル分割を進めること。

## 詳細（問題のあるファイルのみ）

### `db/schema.ts` ⚠️⚠️

**責務**: 全テーブル/ビュー/enum/ポリシーの Drizzle スキーマ定義。

**問題点**:

- 単一ファイルに全ドメイン（users, artists, songs, posts, groups, genres 等の11エンティティ）のスキーマが詰め込まれている
- ファイル長が600+行
- 技術的には「スキーマ定義」という一責務だが、ドメイン境界の認知負荷が高い
- 影響範囲も広く、一部変更で全体がリビルド対象になる
- ファイル内で `users` → `serverSessions`/`favoriteArtists`/`posts` 等が相互に `.references()` で結合されており、エンティティごとの分割が難しい

**推奨**（低優先度）:

- 段階的に `schema/users.ts`, `schema/artists.ts`, `schema/songs.ts`, `schema/posts.ts` のようにドメイン別ファイルへ分割
- `schema/index.ts` で barrel export
- Drizzle はディレクトリ構成に対応しているためリファクタリングは安全

---

### `errors/error-registry.ts` ⚠️

**責務**: 3つのレジストリ（`STATUS_ERROR_TYPES`, `ERROR_TYPES`, `POSTGRES_CONSTRAINTS`）と検索API。

**問題点**:

- 一つのファイルで3つの異なる関心事を保持:
  1. **汎用HTTPエラーレジストリ**（`STATUS_ERROR_TYPES`）
  2. **ドメインエラーレジストリ**（`ERROR_TYPES`, 行120-210）
  3. **Postgres制約レジストリ**（`POSTGRES_CONSTRAINTS`, 行212-250）
- それぞれが独立して変更されうる（HTTP追加、ドメイン仕様追加、DB制約追加）ため、変更理由が複数ある

**推奨**:

- 3ファイルへ分離:
  - `registry/http-error-types.ts`
  - `registry/domain-error-types.ts`
  - `registry/postgres-constraints.ts`
- `error-registry.ts` は barrel のみにする。コード互換性も保てる。

---

### `errors/error-response.ts` ⚠️

**責務**: エラーオブジェクト → RFC 9457 Problem Details への変換、Hono レスポンス生成ヘルパ群。

**問題点**:

- 2種類の異なる関心が混在:
  - **純粋な変換関数**: `formatErrorResponse`, `toProblemDetails`, `toInternalError`, `createProblemInstance`（テスト容易）
  - **Hono Context 依存のI/O関数**: `problemResponse`, `badRequestResponse`, `unauthorizedResponse`, `respondWithError`（Hono結合あり）
- 前者はテスト容易だが、後者は Hono への結合があるため責務が異なる

**推奨**:

- 変換ロジックを `error-format.ts` へ、Hono Context 利用ヘルパを `error-response.ts` へ分離

---

### `firebase/firebase-google.ts` ⚠️

**責務**: Google OAuth 認可コード → トークン交換（`exchangeGoogleCode`）、および Firebase signInWithIdp 呼び出し（`signInWithGoogleIdp`）。

**問題点**:

- 2つの異なる外部サービス連携が同一ファイルにある:
  1. `exchangeGoogleCode`（行46-150）— Google OAuth レイヤ
  2. `signInWithGoogleIdp`（行160-260）— Firebase IdP レイヤ
- それぞれ独立したエラークラス、独立したスキーマ定義を持つ
- 行1-40 のスキーマ/定数も関心事ごとに分かれている

**推奨**:

- `firebase-google-token.ts`（`exchangeGoogleCode`）と `firebase-idp.ts`（`signInWithGoogleIdp`）へ分割
- それぞれの `problemSlug` 定数とスキーマも対応するファイルへ移動
