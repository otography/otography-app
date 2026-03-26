# Phase 3: apps/web コンポーネントテスト導入

## Context

Phase 1（`@repo/errors` ユニットテスト）と Phase 2（`apps/api` 統合テスト、51テスト通過）が完了。Phase 3 では `apps/web` のクライアントコンポーネント + サーバーサイドユーティリティのテストを追加する。

## 前提知識

- Web アプリは**薄いフロントエンド** — Firebase クライアント SDK は使わず、全 auth は `apps/api` への Hono RPC 経由
- **クライアントコンポーネントは2つのみ**: `LoginForm`, `SignOutButton`
- **サーバーサイド関数**: `guardAuthenticatedRoutes`（純粋関数）, `getCurrentUser`（async + fetch）
- React 19 + React Compiler 有効化済み（テストには影響しない — Compiler は Next.js build 時のみ適用）
- `@t3-oss/env-nextjs` が import 時に `process.env.NEXT_PUBLIC_API_URL` を読むため、テストで `@/env` をモック必須

## テスト環境

- **jsdom** — `@testing-library/react` との互換性が最も高い（`happy-dom` は React 19 で未確認のエッジケースあり）
- `proxy-auth.test.ts` と `current-user.test.ts` は DOM 不要のため `// @vitest/environment node` ドックブロックで `node` 環境に切替

## 変更ファイル一覧

### 変更

| ファイル                | 変更内容                              |
| ----------------------- | ------------------------------------- |
| `apps/web/package.json` | `"test": "vitest run"` + devDeps 追加 |

### 新規作成

| ファイル                                                     | 内容                                           |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `apps/web/vitest.config.ts`                                  | `@` alias + jsdom environment                  |
| `apps/web/src/__tests__/setup.ts`                            | `@testing-library/jest-dom/vitest` import のみ |
| `apps/web/src/__tests__/lib/proxy-auth.test.ts`              | ルートガードテスト                             |
| `apps/web/src/__tests__/lib/current-user.test.ts`            | getCurrentUser テスト                          |
| `apps/web/src/__tests__/components/sign-out-button.test.tsx` | サインアウトボタンテスト                       |
| `apps/web/src/__tests__/components/login-form.test.tsx`      | ログインフォームテスト                         |

### 変更なし

- `apps/web/tsconfig.json` — 既に DOM lib + `jsx: "preserve"` を含む
- `turbo.json` — 既に `test` タスク定義済み
- ソースコード（`login-form.tsx`, `sign-out-button.tsx` 等）— 一切変更しない

## インストールするパッケージ

`apps/web/package.json` の devDependencies に追加:

```
vitest: ^4.1.2
jsdom: ^26.0.0
@testing-library/react: ^16.3.0
@testing-library/jest-dom: ^6.6.0
@testing-library/user-event: ^14.6.0
```

## モック戦略

### クライアントコンポーネントテスト

| モジュール        | モック内容                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `next/navigation` | `useRouter` → `{ push, refresh }`, `useSearchParams` → `URLSearchParams`                                |
| `@/lib/api`       | `api.auth["sign-in"].$post`, `api.auth["sign-up"].$post`, `api.auth["sign-out"].$post`, `api.user.$get` |
| `@/env`           | `env.NEXT_PUBLIC_API_URL` → `"http://localhost:3001"`                                                   |

### proxy-auth.test.ts（node 環境）

**モック不要** — `NextRequest` / `NextResponse` は `next/server` から直接インスタンス化して使用:

```ts
new NextRequest(new URL("/account", "http://localhost:3000"), { headers });
```

### current-user.test.ts（node 環境）

| モジュール         | モック内容                                            |
| ------------------ | ----------------------------------------------------- |
| `next/headers`     | `cookies()` → Promise<{ toString(): string }>         |
| `@/env`            | `env.NEXT_PUBLIC_API_URL` → `"http://localhost:3001"` |
| `globalThis.fetch` | `vi.stubGlobal("fetch", vi.fn())`                     |

## テストケース

### guardAuthenticatedRoutes（~10 tests）

- 公開パス（`/login`）→ `NextResponse.next()`
- 認証済み（cookie あり）→ `NextResponse.next()`
- 未認証（cookie なし）→ 307 リダイレクト to `/login`
- cookie 値が空文字 → リダイレクト

### getCurrentUser（~7 tests）

- 200 → パース済みユーザーデータを返す
- 401 → `null` を返す
- 500 → throw
- レスポンスボディがスキーマ不一致 → throw
- cookie をリクエストヘッダーに転送することを確認

### SignOutButton（~10 tests）

- 初期表示: "Sign out" ボタン、エラーなし
- 成功: `$post()` 呼び出し → `router.push("/login")` + `router.refresh()`
- pending: "Signing out..." 表示、ボタン disabled
- エラー: サーバーメッセージ表示、JSON パース失敗時のデフォルトメッセージ、ネットワークエラー時のメッセージ
- 再試行: 前回のエラーをクリア

### LoginForm（~25 tests）

- 初期表示: email/password input、Sign in/Create account ボタン、Google/Apple OAuth リンク
- エラー表示: `searchParams.get("error")` を表示
- サインイン: `$post()` 呼び出し → 成功時 `router.push("/account")`、失敗時エラー表示、ネットワークエラー時メッセージ
- pending: "Signing in..." / "Creating..." 表示、ボタン/OAuth リンク disabled
- サインアップ: 成功後 `api.user.$get()` を呼び出す（プロファイル作成）、失敗時は呼び出さない
- フォームバリデーション: input 値の更新

## 実行順序

1. `apps/web/package.json` に scripts + devDeps 追加 → `bun install`
2. `apps/web/vitest.config.ts` 作成
3. `apps/web/src/__tests__/setup.ts` 作成
4. `proxy-auth.test.ts`（モック不要の純粋関数 — インフラ検証に最適）
5. `current-user.test.ts`
6. `sign-out-button.test.tsx`（初の DOM テスト）
7. `login-form.test.tsx`（最も複雑）
8. `bun run test` + `bun run check-types` + `bun run lint` で検証

## 検証方法

```bash
bun run test                    # 全ワークスペースのテスト（Phase 1+2+3）
cd apps/web && bunx vitest      # watch モード
bun run check-types             # 型チェック
bun run lint                    # oxlint
```
