# features/ への再編成

## Context

`src/lib/` が4ファイル（`api.ts`, `server-api.ts`, `current-user.ts`, `auth.ts`）で、すべて認証機能に使われている。feature-based アーキテクチャにするため、これらを `features/` 配下に移動する。`api.ts` と `server-api.ts` は将来的に他 feature でも使うため `features/lib/` に配置、認証固有の `current-user.ts` と `auth.ts` は `features/auth/lib/` に配置。

## 移動後の構造

```
src/
  features/
    lib/                          # ← 新規: feature間共有のAPIインフラ
      api.ts                      #   (from src/lib/api.ts)
      server-api.ts               #   (from src/lib/server-api.ts)
    auth/
      index.ts                    # barrel: components + lib 関数をre-export
      auth-context.ts             # (変更なし)
      auth-provider.tsx           # import パス更新
      lib/                        # ← 新規: auth固有のサーバーロジック
        current-user.ts           #   (from src/lib/current-user.ts)
        auth.ts                   #   (from src/lib/auth.ts)
        current-user.test.ts      #   (from src/__tests__/lib/current-user.test.ts)
      components/
        ...                       # import パス更新のみ
  app/
    ...                           # import パス更新のみ
  env.ts                          # (変更なし)
```

`src/lib/` ディレクトリは消滅。`src/__tests__/lib/` も消滅（テストは `features/auth/lib/` に配置）。

## 変更ファイル一覧

### 移動（6ファイル）

| 元                                       | 先                                           |
| ---------------------------------------- | -------------------------------------------- |
| `src/lib/api.ts`                         | `src/features/lib/api.ts`                    |
| `src/lib/server-api.ts`                  | `src/features/lib/server-api.ts`             |
| `src/lib/current-user.ts`                | `src/features/auth/lib/current-user.ts`      |
| `src/lib/auth.ts`                        | `src/features/auth/lib/auth.ts`              |
| `src/__tests__/lib/current-user.test.ts` | `src/features/auth/lib/current-user.test.ts` |
| `src/__tests__/setup.ts`                 | 変更なし                                     |

### import パス更新（11ファイル）

| ファイル                                          | 変更                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| `features/auth/auth-provider.tsx`                 | `@/lib/api` → `@/features/lib/api`                    |
| `features/auth/components/sign-out-button.tsx`    | `@/lib/api` → `@/features/lib/api`                    |
| `features/auth/components/setup-profile-form.tsx` | `@/lib/api` → `@/features/lib/api`                    |
| `features/auth/lib/auth.ts`                       | `@/lib/current-user` → `./current-user` (相対)        |
| `features/auth/lib/current-user.ts`               | `@/lib/server-api` → `@/features/lib/server-api`      |
| `app/page.tsx`                                    | `@/lib/auth` → `@/features/auth` (barrel経由)         |
| `app/setup-profile/page.tsx`                      | `@/lib/auth` → `@/features/auth` (barrel経由)         |
| `app/(protected)/layout.tsx`                      | `@/lib/auth` → `@/features/auth` (barrel経由)         |
| `app/(protected)/account/page.tsx`                | `@/lib/auth` → `@/features/auth` (barrel経由)         |
| `app/(public)/layout.tsx`                         | `@/lib/current-user` → `@/features/auth` (barrel経由) |

### テストのモックパス更新（4ファイル）

| ファイル                                               | モックパス変更                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `features/auth/components/auth.test.tsx`               | `@/lib/api` → `@/features/lib/api`                                     |
| `features/auth/components/setup-profile-form.test.tsx` | `@/lib/api` → `@/features/lib/api`                                     |
| `features/auth/components/sign-out-button.test.tsx`    | `@/lib/api` → `@/features/lib/api`                                     |
| `features/auth/lib/current-user.test.ts`               | `@/lib/server-api` → `@/features/lib/server-api`, import先も相対パスに |

### barrel 更新（1ファイル）

`features/auth/index.ts` に lib 関数を追加:

```ts
export { SignInForm } from "./components/sign-in-form";
export { SignUpForm } from "./components/sign-up-form";
export { SignOutButton } from "./components/sign-out-button";
export { SetupProfileForm } from "./components/setup-profile-form";
export { requireAuth, requireNoProfile, getAuthState, type AuthState } from "./lib/auth";
export { getCurrentUser } from "./lib/current-user";
```

## 検証

1. `bun run check-types --filter=web` — 型エラーなし
2. `bun run test --filter=web` — テスト全通過
3. `bun run lint --filter=web` — リントエラーなし
