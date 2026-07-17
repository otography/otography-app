# MUS-27: verifySessionCookie の checkRevoked=true による毎リクエスト Firebase 往復の解消

## Context

`apps/api/src/shared/firebase/firebase-admin.ts:25` が `firebaseAuth.verifySessionCookie(cookie, true)` を呼んでおり、`checkRevoked=true` のため認証リクエスト毎に Firebase の `getUser` REST API 往復が発生している（`packages/firebase-auth-rest/src/auth/base-auth.ts:1174` の `verifyDecodedJWTNotRevokedOrDisabled` 経由）。セッションクッキーは本来オフライン（公開鍵）検証で済む設計であり、全認証エンドポイントに外部 API 1 往復分のレイテンシが上乗せされている。

**方針:** 通常のリクエストはオフライン検証のみ（`checkRevoked=false`）にし、失効・無効化チェックはセンシティブ操作にのみ残す。調査の結果、該当するセンシティブ操作は **`DELETE /api/user`（アカウント削除）のみ**。パスワード変更・メール変更のエンドポイントは存在せず、sign-out は自身で `revokeRefreshTokens` を呼ぶため不要。

**トレードオフ（承知の上で受け入れる）:** ホットパスでは失効済みセッション・無効化ユーザーの検出がクッキー有効期限（5日）まで遅延しうる。ただし refresh token 交換は Firebase 側で失効・無効化を拒否するため、実際の露出はセッションクッキーの残存期間に限られる。

## 設計

### 1. Wrapper を 2 関数に分割（`firebase-admin.ts`）

boolean 引数ではなく名前付き関数 2 つにする（boolean trap 回避、既存の named export スタイルに一致）。errore スタイル（`Promise<DecodedIdToken | AuthError>`）は維持。

```ts
// 通常のセッション検証（オフライン JWT 検証のみ）。Firebase への getUser 往復を避ける。
// 失効・無効化チェックが必要なセンシティブ操作では verifySessionCookieStrict を使うこと。
const verifySessionCookie = (cookie: string) =>
  firebaseAuth
    .verifySessionCookie(cookie, false)
    .catch((e) => AuthError.fromFirebase(e, "Session verification failed."));

// センシティブ操作（アカウント削除など）用の厳格検証。checkRevoked=true で失効・無効化を確認する。
const verifySessionCookieStrict = (cookie: string) =>
  firebaseAuth
    .verifySessionCookie(cookie, true)
    .catch((e) => AuthError.fromFirebase(e, "Session verification failed."));
```

既存の 3 呼び出し箇所（`auth.middleware.ts:17`, `:63`, `session-refresh.ts:31`）はシグネチャ不変のため無変更で自動的にオフライン検証になる。`session-refresh.ts:31` は直前の refresh token 交換が Firebase 側で失効・無効化ユーザーを拒否済みのため `checkRevoked` は元々冗長 — その旨のコメントを 1 行追記。

### 2. `requireFreshSessionMiddleware` を新設（`auth.middleware.ts`）

`DELETE /api/user` 用の per-route ミドルウェア。ハンドラはキャッシュ済み claims（`getAuthSession`）しか見ないため、生クッキーを `verifySessionCookieStrict` で再検証するミドルウェアを `requireAuthMiddleware()` の後段に置く。

ロジック:

- セッションクッキーなし + `authSession` あり（refresh 経由で認証済み）→ 通過。refresh token 交換自体が失効・無効化ユーザーで失敗するため fresh とみなせる
- セッションクッキーなし + `authSession` なし → 401（`unauthorizedResponse`）
- 厳格検証成功 → 通過
- 厳格検証失敗 → `refreshSession(c)` にフォールバック（期限切れクッキー + 有効な refresh token の救済。フォールバックなしだと requireAuthMiddleware が refresh で通した直後にここで 401 + clearCookie する回帰が起きる）。それも失敗なら `clearCookie` フラグに従い `clearSessionCookie` して `respondWithError(claims, c)`

エラーマッピングは既存の `AUTH_ERROR_CONFIG`（`packages/errors/src/auth-error.ts:15–56`）をそのまま再利用: `auth/session-cookie-revoked` → 401 + clearCookie、`auth/user-disabled` → 403 + clearCookie。新エラー型は不要。

既存ヘルパーを再利用: `getSessionCookie` / `clearSessionCookie`（`shared/auth/session-cookie.ts`）、`refreshSession` / `handleRefreshResult`（`shared/auth/session-refresh.ts`）、`respondWithError` / `unauthorizedResponse`（`shared/errors/error-response.ts`）。

### 3. ルート配線（`features/user/route.ts:92`）

```ts
.delete("/api/user", csrfProtection(), requireAuthMiddleware(), requireFreshSessionMiddleware(), async (c) => { ... })
```

`shared/middleware/index.ts` に `requireFreshSessionMiddleware` の export を追加。

## テスト戦略

前提: `__tests__/setup.ts:39–43` が firebase-admin モジュール全体をモックしている。`vi.importActual` はそのモジュールのモックだけをバイパスし、依存（`@repo/firebase-auth-rest/auth` の `getAuth` → `mockVerifySessionCookie`）はモックのまま。`vitest.config.ts` の miniflare bindings が `FIREBASE_PRIVATE_KEY` 等のダミーを注入するため `cloudflare:workers` の env も解決可能 → 本物の wrapper の `checkRevoked` 引数を直接観測できる。

**setup.ts の拡張（最初に行う・必須）:** `mockVerifySessionCookieStrict` を追加し、firebase-admin モック factory と export リストに追加。これを忘れると strict が undefined になり `instanceof Error` を素通りしてサイレントに緑になる。

### TDD テストリスト（t-wada 式: 1 振る舞いずつ red→green）

**firebase-admin wrapper — 新規 `__tests__/shared/firebase/firebase-admin.test.ts`（`vi.importActual` 使用）**

1. `verifySessionCookie` は下位ライブラリを `(cookie, false)` で呼ぶ
2. `verifySessionCookieStrict` は `(cookie, true)` で呼ぶ
3. `verifySessionCookieStrict` は Firebase エラーを AuthError として値で返す（throw しない）

**requireFreshSessionMiddleware — `__tests__/shared/middleware/auth.middleware.test.ts` に describe 追加** 4. 厳格検証成功 → next() 実行（200）5. session-cookie-revoked → 401、problem type `.../session-revoked` 6. user-disabled → 403、problem type `.../account-disabled` 7. 厳格検証失敗でも refreshSession 成功 → 通過（200）8. クッキーなし・authSession なし → 401 9. クッキーなし・authSession あり（refresh 経由）→ 通過

**DELETE /api/user 統合 — `__tests__/features/auth/user.test.ts`** 10. 失効セッション → 401 session-revoked（deleteAccount の DB 操作は実行されない）11. 無効化ユーザー → 403 account-disabled 12. 有効セッション → 200（既存テストに `mockVerifySessionCookieStrict.mockResolvedValue(...)` を追加）

既存の auth.middleware.test.ts / session-refresh.test.ts は wrapper 名が不変のため無変更で通る。

## 実装ステップ

1. `__tests__/setup.ts` — `mockVerifySessionCookieStrict` 追加（テスト基盤）
2. Red 1–3: `__tests__/shared/firebase/firebase-admin.test.ts` 新規作成 → 失敗確認
3. Green 1–3: `firebase-admin.ts` — 既存 wrapper を `false` に、`verifySessionCookieStrict` 追加、export 追加
4. Red 4–9: auth.middleware.test.ts に describe 追加 → import エラーで失敗
5. Green 4–9: `auth.middleware.ts` に `requireFreshSessionMiddleware` 実装、`middleware/index.ts` に export
6. Red 10–12: user.test.ts の DELETE describe 更新 → route 未配線で失敗
7. Green 10–12: `features/user/route.ts:92` にミドルウェア挿入
8. `session-refresh.ts:31` にコメント 1 行追記

## 変更ファイル

修正:

- `apps/api/src/shared/firebase/firebase-admin.ts`（core）
- `apps/api/src/shared/middleware/auth.middleware.ts`
- `apps/api/src/shared/middleware/index.ts`
- `apps/api/src/features/user/route.ts`
- `apps/api/src/__tests__/setup.ts`
- `apps/api/src/__tests__/shared/middleware/auth.middleware.test.ts`
- `apps/api/src/__tests__/features/auth/user.test.ts`
- `apps/api/src/shared/auth/session-refresh.ts`（コメントのみ）

新規:

- `apps/api/src/__tests__/shared/firebase/firebase-admin.test.ts`

対象外: `db.middleware.ts`（セッション検証と無関係）、`packages/firebase-auth-rest`（ライブラリのデフォルトは既に `false`）

## 検証

```bash
# ステップ毎の red→green 確認
cd apps/api && bunx vitest run src/__tests__/shared/firebase/firebase-admin.test.ts
cd apps/api && bunx vitest run src/__tests__/shared/middleware/auth.middleware.test.ts
cd apps/api && bunx vitest run src/__tests__/features/auth/user.test.ts

# 全体
bun run test --filter=api
bun run check-types
bun run lint
```

注意: firebase-admin.test.ts では `beforeEach` で `vi.clearAllMocks()` を呼び、他テストのモック設定の漏れを防ぐ。
