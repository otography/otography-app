# 02 — features/apple-music, health, errors SRPレビュー

**対象ファイル**:

- `features/apple-music/index.ts`, `route.ts`
- `features/health/index.ts`, `route.ts`
- `features/errors/index.ts`, `route.ts`

## 結果サマリー

| ファイル               | SRP | 合成性 | 判定               |
| ---------------------- | --- | ------ | ------------------ |
| `apple-music/index.ts` | ✅  | ✅     | 問題なし           |
| `apple-music/route.ts` | ✅  | ✅     | 模範的な薄いルート |
| `health/index.ts`      | ✅  | ✅     | 問題なし           |
| `health/route.ts`      | ⚠️  | ⚠️     | **要改善**         |
| `errors/index.ts`      | ✅  | ✅     | 問題なし           |
| `errors/route.ts`      | ⚠️  | ✅     | 要改善（軽微）     |

## 詳細

### `features/apple-music/route.ts` ✅

**責務**: `GET /api/apple-music/token` エンドポイント。Cache-Control、認証、レートリミット、JWT生成を順次呼び出す。

薄いオーケストレーション層として全てを委譲:

- JWT生成 → `generateWebDeveloperToken`
- 認証 → `requireAuthMiddleware`
- レートリミット → `rateLimitByUser`
- エラーレスポンス → `respondWithError`

プロジェクトの route/usecase/repository/model パターンの模範例。改善不要。

---

### `features/health/route.ts` ⚠️⚠️

**責務**: `/`（liveness）と `/ready`（readiness）の2エンドポイント。`/ready` は DB・Firebase・Apple Music の3つのヘルスチェックを並列実行し、結果を集約。

**問題点**:

1. **責務の混在**: route.ts 1ファイルに以下が全て詰まっている:
   - 定数定義（行8-9: `APPLE_MUSIC_TIMEOUT_MS`, `APPLE_MUSIC_CHECK_URL`）
   - 型定義（行11-19: `CheckStatus`, `CheckResult`）
   - ビジネスロジック / 依存関係チェック関数（行22-71: `checkDatabase`, `checkFirebase`, `checkAppleMusic`）
   - ルーティング（行73-115）
   - ステータス集約ロジック（行86-105: `criticalDown` / `hasDegraded` / `overallStatus` 判定）

2. **並列チェックの順序依存**（行79-82）: タプルの順序と変数名を人間が一致させる必要がある。

   ```ts
   const [database, firebase, appleMusic] = await Promise.all([
     checkDatabase(c.var.db()),
     checkFirebase(c.env),
     checkAppleMusic(),
   ]);
   ```

3. **ステータス集約がルート内にインライン**（行86-105）: DB/Firebaseはcritical、Apple Musicはnon-critical というビジネスルールがテスト不可能。

**推奨される改善**:

- `features/health/checks/database.ts`, `firebase.ts`, `apple-music.ts` のように各チェックを個別ファイルへ分離
- `features/health/aggregate.ts` に `aggregateStatus(checks): { status, httpStatus }` を抽出し、ステータス判定ロジックをユニットテスト可能に
- `route.ts` はルーティング定義とオーケストレーション、レスポンス整形のみに専念
- `Promise.all` を `Record` ベースに変更し順序依存を排除

---

### `features/errors/route.ts` ⚠️

**責務**: `GET /:type` エンドポイント。スラッグからエラー型を検索し、Accept ヘッダーに応じて JSON または HTML でドキュメントを返す。

**問題点**:

1. **HTMLテンプレートのインライン埋め込み**（行32-47）: 50行近くのヒアドキュメントHTMLがルートファイル内にある。プレゼンテーション関心事がルートに漏出している。

2. **XSSリスクの可能性**（行43, 45）: `${entry.title}` / `${entry.description}` をHTMLに直接埋め込んでいる。出所がコード内固定値であれば即時リスクは低いが、エスケープが必要。

3. **コンテンツネゴシエーションがインライン**（行22-49）: Accept ヘッダー分岐とレスポンス生成が抽出可能。

**推奨される改善**:

- `features/errors/render.ts` を新設し、`renderErrorDocJson(entry)` と `renderErrorDocHtml(entry)` を分離
- HTML文字列はテンプレート関数に。プレースホルダ置換時にHTMLエスケープを必須化
- `findProblemType` への委譲は ✅（registry/lookup パターンとして正しく分離されている）
