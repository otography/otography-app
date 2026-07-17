# MUS-30: ページネーション入力の未検証による 500 を 400 に修正

Linear: [MUS-30](https://linear.app/music-social/issue/MUS-30)（High / Bug）
Branch: `mucunyoujie18/mus-30-api-ページネーション入力が未検証で-500-に直結（limitnan-不正-cursor）`

## Context

一覧系エンドポイント（posts / songs / artists / favorite-songs ×2 / favorite-artists ×2）はページネーションクエリを手書き `parseInt` でパースしており未検証:

- `?limit=abc` → `parseInt` → `NaN` → `normalizeLimit` も NaN を素通し（`Math.min(Math.max(1, NaN), 100)` = NaN）→ `qb.limit(NaN + 1)` で SQL エラー → **500**
- `?cursor[createdAt]=不正文字列` → `cursorWhereClause` の `::timestamptz` キャストで Postgres エラー → **500**

`shared/pagination/schema.ts` に `paginationInputSchema` / `limitSchema` が存在するのにルートから未使用。同一の手書きパース ~8 行が 4 か所に重複している（posts / songs / artists のインライン + `favorite-shared.ts` の `parsePaginationQuery`）。

**修正方針**: 検証付きの共有 `arktypeValidator("query", ...)` に統一し、不正入力は RFC 9457 Problem Details の 400 を返す。

## 設計判断（確定事項）

1. **バリデータ middleware 方式**（errore ヘルパーではなく）。本リポジトリの HTTP 境界検証は一貫して `arktypeValidator("json"|"param", schema, hook → badRequestResponse)`（例: `posts/route.ts:20-40`）。query も同じイディオムにし、`c.req.valid("query")` で型付き入力 + Hono RPC `AppType` の query 型も改善される。
2. **範囲外 limit（0 / 負数 / 101+）は 400 で拒否**（ユーザー確認済み）。従来の normalizeLimit クランプ（0→1、101→100）からの意図的な挙動変更。`normalizeLimit` 自体は usecase 側の defense-in-depth と `undefined → DEFAULT_LIMIT` のため現状維持。
3. **cursor は両方指定 or 両方未指定のみ許可**。片側のみは従来サイレント無視 → 400 に変更（クライアントのバグを隠さない）。
4. **`cursor[createdAt]` は `string.date.parsable` で検証**（`string.date.iso` ではない）。DB のタイムスタンプは `timestamp(..., { mode: "string" })`（`shared/db/schema.ts:93` 等）で Postgres テキスト形式（`2026-01-01 00:00:00.123+00`）が返るため、API が返す `nextCursor.createdAt` をそのままエコーバックするクライアントを `string.date.iso` は拒否してしまう。`string.date.parsable` は ISO と pg 形式の両方を許可しつつゴミ文字列を `::timestamptz` の手前で弾く。レスポンス側の `cursorSchema` は変更しない。

## 実装ステップ（t-wada TDD: 各振る舞いごとに Red → Green）

### 1. スキーマ単体テスト → クエリスキーマ実装

**新規テスト** `apps/api/src/__tests__/shared/pagination/query-schema.test.ts`（`types.test.ts` のスタイルに合わせる）。テストリスト:

1. 空オブジェクト → `{ limit: undefined, cursor: undefined }` 許可
2. `limit: "20"` → `{ limit: 20 }`（string→number モーフ）
3. 境界: `"100"` 許可 / `"101"` 拒否 / `"0"` 拒否 / `"-1"` 拒否
4. 非数値: `"abc"` 拒否 / `"1.5"` 拒否 / `""` 拒否
5. cursor 両方有効（ISO 形式）→ `{ cursor: { createdAt, id } }` に整形
6. cursor createdAt が pg テキスト形式（`"2026-01-01 00:00:00.123+00"`）→ 許可（ラウンドトリップ回帰）
7. `cursor[createdAt]` のみ / `cursor[id]` のみ → 拒否
8. `cursor[createdAt]: "garbage"` / `cursor[id]: "not-a-uuid"` → 拒否
9. limit + cursor 併用 → 許可

**実装** `apps/api/src/shared/pagination/schema.ts` に追加:

```ts
/** クエリ文字列 → limit 数値へのモーフ（範囲外は拒否） */
const limitQuerySchema = type("string.integer.parse").to(`0 < number.integer <= ${MAX_LIMIT}`);

/** GET リストエンドポイント共通のページネーションクエリスキーマ */
export const paginationQuerySchema = type({
  "limit?": limitQuerySchema,
  "cursor[createdAt]?": "string.date.parsable",
  "cursor[id]?": "string.uuid",
})
  .narrow((q, ctx) => {
    // cursor は両方指定 or 両方未指定のみ許可
    if ((q["cursor[createdAt]"] === undefined) === (q["cursor[id]"] === undefined)) return true;
    return ctx.mustBe("a complete cursor (both cursor[createdAt] and cursor[id])");
  })
  .pipe((q): { limit?: number; cursor?: Cursor } => ({
    limit: q.limit,
    cursor:
      q["cursor[createdAt]"] !== undefined && q["cursor[id]"] !== undefined
        ? { createdAt: q["cursor[createdAt]"], id: q["cursor[id]"] }
        : undefined,
  }));
```

フォールバック: `string.integer.parse` の `.to` チェーンが arktype v2.2 で問題を起こす場合は、既存 `limitSchema` を export して `type("string.integer.parse").pipe(limitSchema)`。

### 2. posts ルートテスト → 共有バリデータ実装 + posts 配線

**新規** `apps/api/src/shared/pagination/validator.ts`:

```ts
import { arktypeValidator } from "@hono/arktype-validator";
import { badRequestResponse } from "../errors/error-response";
import { paginationQuerySchema } from "./schema";

/** ページネーションクエリの共通バリデータ（不正時は 400 Problem Details） */
export const paginationQueryValidator = arktypeValidator(
  "query",
  paginationQuerySchema,
  (result, c) => {
    if (!result.success) {
      return badRequestResponse(c, "Please provide valid pagination parameters.");
    }
  },
);
```

`shared/pagination/index.ts` から `paginationQuerySchema` / `paginationQueryValidator` を re-export。循環 import なし（shared/errors は shared/pagination を import していない）。

**posts ルートテスト**（`__tests__/features/posts/route.test.ts` に追加、フルマトリクスは posts のみ）:

1. `GET /api/posts?limit=abc` → 400（旧: 500）— Problem Details 形状（`status: 400`）を assert
2. `?limit=0` → 400 / `?limit=101` → 400
3. `?cursor[createdAt]=garbage&cursor[id]=<uuid>` → 400（旧: 500）
4. `?cursor[createdAt]=<iso>`（id 欠落）→ 400
5. `?limit=2&cursor[createdAt]=<iso>&cursor[id]=<uuid>` → 200（既存 db モックで pagination メタ形状を確認）

**posts 配線** `apps/api/src/features/posts/route.ts:43-60`:

```ts
.get("/api/posts", paginationQueryValidator, async (c) => {
  const session = getAuthSession(c);
  const { limit, cursor } = c.req.valid("query");
  const result = await getPosts(session, { limit, cursor }, c.var.db);
  ...
})
```

9 行の手書きパースと `Cursor` 型 import を削除。

### 3. 残り 6 エンドポイントのスモークテスト → 配線

各 route.test.ts に `?limit=abc → 400` を 1 ケースずつ追加（バリデータの配線漏れ検出が目的）:

- `apps/api/src/features/songs/route.ts:28-39` — インラインパースを置換
- `apps/api/src/features/artists/route.ts:34-45` — 同上
- `apps/api/src/features/favorite-songs/route.ts`（:36 / :53 の 2 エンドポイント）— middleware チェーンに `paginationQueryValidator` を追加（`requireAuthMiddleware()` / param バリデータの後）、`parsePaginationQuery(c)` → `c.req.valid("query")`
- `apps/api/src/features/favorite-artists/route.ts`（同 2 エンドポイント）— 同上

### 4. クリーンアップ

- `apps/api/src/features/favorite-shared.ts` から `parsePaginationQuery`（14-28 行）と `Cursor` import を削除（`appleMusicIdParamSchema` / `userIdParamSchema` は残す）
- `bun run check-dead-code`（knip）で未使用 export がないか確認

## 検証

```bash
bun run test --filter=api                     # 単体 + ルートテスト
bun run check-types                           # api と web 両方（AppType 変更の波及確認）
bun run lint
# DB 統合テスト（任意、リポジトリ層は無変更だが念のため）
just db-start && bun run test:db --filter=api
```

手動確認（`bun run dev --filter=api` 起動後）:

```bash
curl -i "http://localhost:3001/api/songs?limit=abc"                    # → 400 application/problem+json
curl -i "http://localhost:3001/api/songs?cursor[createdAt]=garbage&cursor[id]=$(uuidgen)"  # → 400
curl -i "http://localhost:3001/api/songs?limit=2"                      # → 200、nextCursor を取得
# 返ってきた nextCursor をそのままエコーバックして 200 を確認（pg テキスト形式ラウンドトリップ）
```

## 挙動変更・リスク（PR 説明に記載）

- `limit=0/負数` は 1 に、`limit>100` は 100 にクランプされていたが **400 になる**（確認済みの意図的変更。web に既存呼び出しなし — apps/web は現状これらの一覧 `$get` を呼んでいない）
- `?limit=`（空文字）は従来デフォルト扱い → 400。片側のみの cursor はサイレント無視 → 400。`?limit=1&limit=2` の重複指定も 400（Hono の query target で `string[]` になり string 期待に失敗）
- `AppType` の該当 `$get` に query 入力型が付く（改善・非破壊、web の check-types で確認）
- 既存の `normalizeLimit` クランプ単体テスト（`types.test.ts`）は defense-in-depth としてそのまま有効
