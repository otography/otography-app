# MUS-33: fetchArtist / fetchSong の重複を共通化し、レスポンスを arktype で検証

Linear: [MUS-33](https://linear.app/music-social/issue/MUS-33) / branch: `mucunyoujie18/mus-33-api-fetchartist-fetchsong-の重複を共通化し、レスポンスを-arktype-で検証`

## Context

`apps/api/src/shared/apple-music/client.ts` の `fetchArtist`（38-100行）と `fetchSong`（103-165行）は「トークン生成 → fetch → ステータス分岐 → JSON パース → `data[0]` 取り出し」がほぼ完全な重複。さらにレスポンスを `body as { data?: ... }` と `as` キャストしており実行時検証が無い（プロジェクトは API 境界での arktype 検証が方針）。

対策: `fetchCatalogResource` に共通化し、arktype スキーマで実行時検証、不一致は新設の `AppleMusicError` として返す（errore の errors-as-values 規約）。

**調査で判明した重要事項:**

- `AppleMusicError` は現存しない。クライアントは現在 `DbError` を返している（Apple Music API のエラーに DbError は誤称）。
- `apps/api/src/shared/errors/error-response.ts:125` の `formatErrorResponse` は `instanceof DbError` で分岐して `statusCode` を HTTP レスポンスにマップしている。新エラー型に分岐を追加しないと unknown Error 扱い → 一律 500 になり、404/502 が壊れる（route テストはモジュールをモックするため検知できないサイレント回帰）。**分岐追加は必須。**
- 全呼び出し元（`features/{artists,favorite-artists,songs,favorite-songs,posts}/usecase.ts`）は `instanceof Error` で narrowing しているため、エラー型の差し替えで呼び出し元の変更は不要。
- `to-song-input.ts` は `ReturnType<typeof fetchSong>` から型を導出しているため自動追従。

## 変更ファイル

| ファイル                                                   | 変更                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/errors/src/apple-music-error.ts`                 | 新規: `AppleMusicError`（`db-error.ts` を踏襲、デフォルト statusCode 502）  |
| `packages/errors/src/index.ts`                             | export 追加                                                                 |
| `apps/api/src/shared/errors/error-response.ts`             | `instanceof AppleMusicError` 分岐を DbError 分岐の隣に追加                  |
| `apps/api/src/shared/apple-music/client.ts`                | arktype スキーマ + `fetchCatalogResource` に書き換え、`DbError` import 削除 |
| `apps/api/src/__tests__/shared/apple-music/client.test.ts` | 新規: クライアントの専用テスト                                              |
| 既存 route/usecase テスト                                  | モックの `DbError` を `AppleMusicError` に差し替え（後述）                  |

## 設計

### 1. AppleMusicError（packages/errors）

`packages/errors/src/db-error.ts` を踏襲:

```ts
class AppleMusicError extends errore.createTaggedError({
  name: "AppleMusicError",
  message: "$message",
}) {
  readonly statusCode: ErrorStatusCode; // デフォルト 502（主要な失敗モード）
  readonly problemSlug?: ProblemSlug;
  constructor(args: {
    message: string;
    statusCode?: ErrorStatusCode;
    problemSlug?: ProblemSlug;
    cause?: unknown;
  });
}
```

`packages/errors/src/index.ts` から export。

### 2. arktype スキーマ（client.ts 内にインライン）

既存のローカル TS 型を `typeof schema.infer` に置き換える。arktype のデフォルト（未宣言キー許容）は Apple Music レスポンスの余分なフィールド（`href`, `type`, artwork 等）に対して正しい挙動。

```ts
const appleMusicArtistSchema = type({
  id: "string",
  attributes: { name: "string" },
});

const appleMusicSongSchema = type({
  id: "string",
  attributes: {
    name: "string",
    "durationInMillis?": "number",
    "isrc?": "string",
    genreNames: "string[]",
  },
  "relationships?": {
    "artists?": {
      "data?": type({
        id: "string",
        type: "'artists'",
        "attributes?": { name: "string" },
      }).array(),
    },
  },
});

export type AppleMusicArtist = typeof appleMusicArtistSchema.infer;
export type AppleMusicSong = typeof appleMusicSongSchema.infer;
```

### 3. fetchCatalogResource

2 段階検証（共通エンベロープ `type({ "data?": "unknown[]" })` → 先頭要素にリソース別スキーマ）でジェネリクスと arktype の相性問題を回避。検証テンプレートは `apps/api/src/shared/firebase/firebase-rest.ts:68-105` の `instanceof type.errors` パターンに従う。

```ts
const fetchCatalogResource = async <T>(options: {
  resourceType: "artists" | "songs";
  id: string;
  schema: Type<T>;                       // 単一リソースのスキーマ
  searchParams?: Record<string, string>; // 例: { include: "artists" }
  messages: { notFound: string; fetchFailed: string };
}): Promise<T | AppleMusicError>
```

フロー: `generateDeveloperToken().catch` → 502 / fetch `https://api.music.apple.com/v1/catalog/jp/${resourceType}/${id}` `.catch` → 502 / `!ok`: 404 → `messages.notFound`、それ以外 → 502 `messages.fetchFailed` / `response.json().catch` → 502 パースエラー / エンベロープ検証失敗 → 502 / `data?.[0]` 欠落 → 404 `messages.notFound` / `schema(first)` が `instanceof type.errors` → 502 スキーマ不一致（`.summary` をメッセージに含める）。

`fetchArtist` / `fetchSong` は薄いラッパーに:

```ts
export const fetchArtist = (appleMusicId: string) =>
  fetchCatalogResource({ resourceType: "artists", id: appleMusicId, schema: appleMusicArtistSchema, messages: {...} });
export const fetchSong = (appleMusicId: string) =>
  fetchCatalogResource({ resourceType: "songs", id: appleMusicId, schema: appleMusicSongSchema, searchParams: { include: "artists" }, messages: {...} });
```

**注意:** arktype の `Type<T>` を引数型にすると variance の摩擦が出る場合がある。その場合は `type.Any<T>` にフォールバック（実行時呼び出しは同一）。

### 4. メッセージ・ステータスの完全保存

既存の日本語メッセージと statusCode をバイト単位で維持（route テストが detail を検証している）:

- トークン生成失敗: 502 「Apple Music トークンの生成に失敗しました。」
- リクエスト失敗: 502 「Apple Music API のリクエストに失敗しました。」
- パース失敗: 502 「Apple Music API レスポンスのパースに失敗しました。」
- artist: 404 「指定されたアーティストが見つかりません。」/ 502 「Apple Music API からアーティスト情報を取得できませんでした。」
- song: 404 「指定された楽曲が見つかりません。」/ 502 「Apple Music API から楽曲情報を取得できませんでした。」
- **新規**: スキーマ不一致 502 「Apple Music API レスポンスが想定スキーマと一致しません: ${summary}」

## 実装手順（t-wada TDD: テストリスト → Red → Green を振る舞いごとに繰り返す）

### Step 1: AppleMusicError

`packages/errors/src/apple-music-error.test.ts`（既存の errors パッケージのテスト規約に従う）。テストリスト: name が "AppleMusicError" / message 透過 / デフォルト statusCode 502 / 明示 statusCode・cause 保持 / `instanceof Error`。Red 確認 → `apple-music-error.ts` 実装 + `index.ts` export で Green。

### Step 2: formatErrorResponse 分岐

既存の error-response テストに Red テスト追加: `new AppleMusicError({ message: "...", statusCode: 404 })` → 404 Problem Details で detail にメッセージ（"Internal server error." ではない）。Green: `error-response.ts` の DbError 分岐の隣に `instanceof AppleMusicError` 分岐（`return mapProblemSlug(error.statusCode, error.message, error.problemSlug)`）。

### Step 3: client.test.ts（Red）

`apps/api/src/__tests__/shared/apple-music/client.test.ts` 新規。モック戦略:

- `vi.mock("../../../shared/apple-music/token", () => ({ generateDeveloperToken: vi.fn() }))` — `cloudflare:workers` import を回避
- `vi.stubGlobal("fetch", mockFetch)` — 前例: `src/__tests__/features/auth/firebase-google.test.ts`

テストリスト（振る舞い単位）:

1. fetchArtist 成功: `https://api.music.apple.com/v1/catalog/jp/artists/{id}` に Bearer トークン付きでリクエスト、`data` の先頭要素を返す
2. fetchSong 成功: URL に `?include=artists` が含まれ、relationships 付きの楽曲を返す
3. HTTP 404 → `AppleMusicError` statusCode 404、notFound メッセージ（artist / song 各々）
4. HTTP 500 → `AppleMusicError` 502、fetchFailed メッセージ
5. fetch reject → `AppleMusicError` 502、リクエスト失敗メッセージ、cause 保持
6. `response.json()` reject → `AppleMusicError` 502、パース失敗メッセージ
7. エンベロープ不一致（例: `{ data: "x" }`）→ `AppleMusicError` 502 スキーマ不一致メッセージ
8. 先頭要素の必須属性欠落（例: `attributes.name` 無し）→ `AppleMusicError` 502、arktype summary を含む（**`as` キャストが黙認していた新規検出動作**）
9. `data: []` / `data` 欠落 → `AppleMusicError` 404 notFound メッセージ
10. `generateDeveloperToken` reject → `AppleMusicError` 502 トークンメッセージ

### Step 4: client.ts 書き換え（Green）

スキーマ + `fetchCatalogResource` を実装し、`fetchArtist` / `fetchSong` を薄いラッパー化。`DbError` import 削除。コメントは日本語。

### Step 5: 既存テストのモック整合

`fetchArtist` / `fetchSong` の戻り値スタンドインとしての `DbError` モックを `AppleMusicError` に差し替え（Step 2 完了後はどちらでも通るが、実際の戻り値型を反映させる）:

- `src/__tests__/features/artists/route.test.ts:360`
- `src/__tests__/features/songs/route.test.ts`（502 ケース）
- `src/__tests__/features/posts/usecase.test.ts:192`

トランザクション経路の `DbError` モックは対象外（触らない）。

### Step 6: 検証

- `bun run test --filter=api` — 新規 client テスト含め全件パス
- `bun run test --filter=@repo/errors`（または errors パッケージのテスト実行）
- `bun run check-types`
- `bun run lint`
- `to-song-input.ts` が無変更でコンパイルされること（推論された `AppleMusicSong` 形状の一致確認）

## スコープ外

- `token.ts` および `features/apple-music/route.ts` のトークンエンドポイントは触らない
- `current-user-errors.ts` の `SchemaValidationError` / `JsonParseError` は web クライアント用（statusCode 無し）のため流用しない — issue の指示どおり専用の `AppleMusicError` を新設する
- storefront の設定化（"jp" ハードコードのまま維持）
