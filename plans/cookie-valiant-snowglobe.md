# グローバルエラーハンドラの cookie 削除修正プラン

## Context

`apps/api/src/index.ts:55-59` の `.onError` 内 cookie 削除に 2 つの欠陥がある:

1. **domain 属性の欠落** — `deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" })` は `path` のみ指定。
   cookie 削除は属性（domain / path）が設定時と一致しないと効かないため、本番のように
   `AUTH_COOKIE_DOMAIN` 付きで設定された session cookie は削除されず、`clearCookie` フラグが機能しない。
2. **refresh token cookie を消していない** — session cookie だけ消しても
   `otography_refresh_token` が残り、「無効セッション + 生きた refresh token」の不整合が起きる。

コードベースには既に正しいパターンが 2 箇所ある。onError だけが outlier:

- `handleAuthError` (`apps/api/src/features/auth/route.ts:33-44`) — `clearCookie` 時に
  `clearSessionCookie(c)` + `clearRefreshTokenCookie(c)` を両方呼ぶ
- `handleRefreshResult` (`apps/api/src/shared/auth/session-refresh.ts:41-55`) — リフレッシュ失敗時に両方クリア

どちらのヘルパーも `domain: c.env.AUTH_COOKIE_DOMAIN || undefined` を正しく指定している
(`shared/auth/session-cookie.ts:26-31`, `shared/auth/refresh-token.ts:144-149`)。

さらに、既存テスト `apps/api/src/__tests__/error-handler.test.ts` は onError ハンドラの
**インラインコピー**（バグ込み）をテストしており、実物を守れていない。このバグがテストをすり抜けたのは
この重複が原因なので、ハンドラを抽出して実物をテストする形に直す。

## 変更内容

### 1. onError ハンドラを共有モジュールに抽出

新規ファイル `apps/api/src/shared/errors/global-error-handler.ts`:

```ts
import type { ErrorHandler } from "hono";
import { clearSessionCookie } from "../auth/session-cookie";
import { clearRefreshTokenCookie } from "../auth/refresh-token";
import { createProblemInstance, formatErrorResponse } from "./error-response";
import { logError } from "../logging/structured-log";
import type { Bindings } from "../types/bindings";

export const globalErrorHandler: ErrorHandler<{ Bindings: Bindings }> = (err, c) => {
  logError(err, c.req.path);
  const { body, statusCode, clearCookie } = formatErrorResponse(err, {
    instance: createProblemInstance(),
  });

  if (clearCookie) {
    // 設定時と同じ domain/path 属性で削除しないと cookie は消えないため、専用ヘルパーを使う
    clearSessionCookie(c);
    clearRefreshTokenCookie(c);
  }

  return c.body(JSON.stringify(body), statusCode, {
    "Content-Type": "application/problem+json",
  });
};
```

### 2. `apps/api/src/index.ts` を書き換え

- `.onError(globalErrorHandler)` に置換
- 不要になった import を削除: `deleteCookie` (hono/cookie)、`SESSION_COOKIE_NAME`、
  `formatErrorResponse` / `createProblemInstance` / `logError`（notFound で使う `problemResponse` は残す）

### 3. テスト修正 — `apps/api/src/__tests__/error-handler.test.ts`

インラインコピーの onError を削除し、抽出した `globalErrorHandler` を
`app.onError(globalErrorHandler)` で実物として適用する。

**TDD テストリスト**（Red → Green の順で 1 つずつ）:

1. `AuthError(clearCookie:true)` + `AUTH_COOKIE_DOMAIN` 設定あり →
   Set-Cookie が `otography_session=;` を `Domain=<設定値>` 付きでクリアする
   （env は `app.request(path, init, { AUTH_COOKIE_DOMAIN: "example.com" })` の第 3 引数で注入）
2. `AuthError(clearCookie:true)` → `otography_refresh_token` も同様に `Domain` 付きでクリアされる
3. `AuthError(clearCookie:true)` + `AUTH_COOKIE_DOMAIN` 未設定 → `Domain` 属性なしでクリアされる（ローカル環境の後退防止）
4. `AuthError(clearCookie:false)` → Set-Cookie なし（既存テストを refresh token も含む形に更新）

既存のテスト 1〜2（Content-Type / DbError）、RlsError、unknown Error、logError、notFound の
ケースはハンドラ差し替え後もそのまま通ること。

## 修正対象ファイル

| ファイル                                             | 変更                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/api/src/shared/errors/global-error-handler.ts` | 新規: 抽出したハンドラ                                            |
| `apps/api/src/index.ts`                              | onError を `globalErrorHandler` に置換、import 整理               |
| `apps/api/src/__tests__/error-handler.test.ts`       | インラインコピーを実物に置換、domain / refresh token のテスト追加 |

## 検証

1. `bun run test --filter=api -- src/__tests__/error-handler.test.ts` — 新テストが Red → Green
2. `bun run test --filter=api` — 全体回帰なし
3. `bun run check-types` / `bun run lint` — 型・lint 通過（Definition of Done）
