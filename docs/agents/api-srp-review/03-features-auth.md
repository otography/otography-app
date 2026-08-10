# 03 — features/auth SRPレビュー

**対象ファイル**:

- `features/auth/index.ts`
- `features/auth/lib/google.ts`
- `features/auth/route.ts`

## 結果サマリー

| ファイル        | SRP | 合成性 | 判定                 |
| --------------- | --- | ------ | -------------------- |
| `index.ts`      | ✅  | ✅     | 問題なし             |
| `lib/google.ts` | ⚠️  | ⚠️     | **要改善**           |
| `route.ts`      | ❌  | ⚠️     | **要改善（最重要）** |

## 根本問題: usecase層の欠落

`features/auth/` には `usecase/` 層が存在しない。プロジェクトのパターン（CLAUDE.md 記載の route/usecase/repository/model）に照らすと、`features/user/usecase`（`createUserRecord` を提供）との一貫性が取れていない。その結果、`route.ts` と `lib/google.ts` の両方がユースケースのオーケストレーションを内包し、route と usecase の境界が曖昧になっている。

---

## 詳細

### `features/auth/index.ts` ✅

バレルファイル。1行の re-export。問題なし。

---

### `features/auth/route.ts` ❌

**責務**: `auth` Hono アプリの構築と `/sign-in`, `/sign-up`, `/sign-out`, `/google`, `/google/callback` のルート定義。

**問題点**:

1. **route.ts がサインイン/サインアップのユースケース本体を内包**:

   `/api/auth/sign-in` ハンドラ（行55-113）が以下を全て順次実行:
   - Firebase 認証委譲（行64-78）
   - ユーザーレコード作成（行81-83）
   - 暗号化コンテキスト取得（行87-89）
   - セッション発行（行92-104）
   - Cookie 設定（行107）
   - 各ステップごとの `console.info` / `console.warn` ロギング（行62, 74-77, 85-86, 108）

   「ルーティング」「ステップごとのエラー分類」「ログ出力」「HTTP レスポンス生成」の複数責務を同時に持つ。

2. **sign-in と sign-up の重複**（行55-113 vs 行116-181）:

   両ハンドラがほぼ同一構造（Firebase → createUserRecord → getCtx → issueSession → setCookie）。違いは `signUpWithPassword` を呼ぶこと、409を`domainAuthError`にマップする分岐、成功時のステータス（201 vs 200）とメッセージのみ。共通フローを抽出可能な usecase そのもの。

3. **ルート固有のユーティリティとスキーマの同居**:
   - `credentialsBodySchema` / `credentialsValidator`（行21-34）→ `model/credentials.ts` に分離すべき
   - `handleAuthError` / `getCtxOrError`（行40-64）→ `lib/` または `shared/auth/` に移動すべき

4. **ログが大量に散在**: sign-in で5箇所、sign-up で5箇所の `console.*` 呼び出し。横断的関心事であり、usecase 層かミドルウェアで一元化すべき。

5. **sign-out ハンドラ（行184-210）は比較的マシ**: `revokeSession` への委譲は適切。

**推奨される改善**:

1. **usecase の新設**: `features/auth/usecase/` を作成:
   - `signInWithEmail({ apiKey, email, password, db, ctx })` — sign-in ハンドラのコア
   - `signUpWithEmail({ apiKey, email, password, db, ctx })` — sign-up ハンドラのコア
   - `signOut({ db, sessionId })` — sign-out のコア
   - `AuthError | Result` を返す純粋関数とし、ハンドラは `respondWithError` に渡すだけに

2. **`route.ts` をワイヤリングのみに**: スキーマ → `model/credentials.ts`、ヘルパー → `lib/` へ移動。

3. **ログの集約**: usecase 内に移動するか、`onSuccess` / `onError` フックで一元化。

4. **共通フローのテンプレート化**: `issueSessionForFirebaseUser({ firebaseResult, db, ctx })` で重複を排除。

---

### `features/auth/lib/google.ts` ⚠️

**責務**: Google OAuth の認可リダイレクトとコールバック処理の2ハンドラ（`googleOAuthRedirect`, `googleOAuthCallback`）。

**問題点**:

1. **ハンドラがビジネスロジックのオーケストレータになっている**:

   `googleOAuthCallback`（行114-246）が1関数で以下を全て実行:
   - クエリパラメータ検証（行115-128）
   - Google 側エラー処理（行131-139）
   - state JWT 検証（行145-150）
   - nonce の cookie 照合（行157-165）— HTTP レイヤの関心事
   - `exchangeGoogleCode` 呼び出し（行169-176）— 委譲 ✅
   - `signInWithGoogleIdp` 呼び出し（行179-186）— 委譲 ✅
   - `createUserRecord` 呼び出し（行189-192）— 委譲 ✅
   - `getEncryptCtx` と `issueSession` 呼び出し（行195-209）— 委譲 ✅
   - Cookie 設定・削除（行212-216）— HTTP レイヤの関心事
   - リダイレクト先 URL 構築（行219-221）— HTTP レイヤの関心事

   「HTTP 入出力」「OAuth state/nonce 検証」「セッション発行フロー」の3責務が混在。

2. **リダイレクト検証の重複**（行100-141, 行79, 行219-221）:
   「相対パスのみ許可」の検証が3箇所で重複。`shared/auth/oauth-state.ts` または専用バリデータに抽出すべき。

3. **OAuth エラーコードマッピングの固有化**（行56-67）:
   `getOAuthErrorCode` / `getStateErrorCode` がプロバイダ固有だが `google.ts` にしか存在せず、Apple OAuth 追加時に重複の恐れ。

**推奨される改善**:

1. **usecase の抽出**: `features/auth/usecase/oauth-signin.ts` を作り、`exchangeGoogleCode → signInWithGoogleIdp → createUserRecord → issueSession` の純粋なオーケストレーション（HTTP コンテキスト非依存）を移動。

2. **リダイレクト検証の共通化**: `safeRedirectPath(path, fallback)` を `shared/auth/oauth-state.ts` に追加し3箇所の重複を排除。

3. **エラーコードマッピングの整理**: `shared/errors/oauth-error-codes.ts` に移動し、プロバイダ拡張に備える。
