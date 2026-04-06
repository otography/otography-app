# Refactor auth middleware: dedicated requireAuthMiddleware

## Context

`requireAuth()` は `authSessionMiddleware` がコンテキストに保存した `authError` に依存して適切なステータスコード（403/503等）を返しているが、これは errore の「エラーは発生場所で処理」の思想に反する。コンテキストにエラーを保存する代わりに、認証必須ルート用の専用ミドルウェアで検証からエラー返却まで一気に行う。

## 変更ファイル

- `apps/api/src/shared/middleware/auth.middleware.ts`
- `apps/api/src/shared/middleware/index.ts`
- `apps/api/src/shared/types/hono.d.ts`
- `apps/api/src/features/auth/route.ts`

## 実装

### 1. 検証ロジックを抽出

`auth.middleware.ts` に共有ヘルパーを追加:

```ts
const verifySessionCookie = (cookie: string) =>
  firebaseAuth
    .verifySessionCookie(cookie, true)
    .catch((e) => AuthError.fromFirebase(e, "Failed to verify the Firebase session cookie."));
```

### 2. authSessionMiddleware を更新

- `authError` 関連のコードをすべて削除
- 検証失敗時: Cookieをクリア → `authSession` を null に設定 → 続行（変更なし）
- 成功時: `authSession` を設定 → 続行（変更なし）

### 3. requireAuth を requireAuthMiddleware に置き換え

- `requireAuth` と `getAuthError` を削除
- 新しい `requireAuthMiddleware` を追加:
  - Cookieがない → 401
  - 検証失敗 → Cookieクリア + 適切なステータスコードで即座に返す
  - 成功 → `authSession` を設定 → 続行

```ts
export const requireAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const sessionCookie = getSessionCookie(c);

    if (!sessionCookie) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      if (claims.clearCookie) clearSessionCookie(c);
      return c.json({ message: claims.message }, claims.statusCode);
    }

    c.set("authSession", claims);
    await next();
  };
};
```

### 4. エクスポートを更新

`middleware/index.ts`: `requireAuth` → `requireAuthMiddleware`

### 5. 呼び出し側を更新

`features/auth/route.ts` line 298:

```ts
// Before
.get("/api/user", requireAuth(), userHandler)
// After
.get("/api/user", requireAuthMiddleware(), userHandler)
```

### 6. 型宣言を更新

`hono.d.ts` に `authError` が宣言されていないので変更不要（そもそも使わなくなる）。

## 検証

- TypeScript型チェック: `bun run --filter @repo/api typecheck`
- `GET /api/user` にCookieなしでアクセス → 401
- `GET /api/user` に無効なCookieでアクセス → 401 + Cookieクリア
