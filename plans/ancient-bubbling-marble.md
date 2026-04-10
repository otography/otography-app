# Plan: `pendingMode` → `isPending` への簡素化

## Context

現在 `/login` と `/signup` は別ページだが、`AuthProvider` が `pendingMode: "sign-in" | "sign-up" | null` を管理し、UI状態とAPI routingが混在している。各ページにはボタンが1つしかないため、`isPending: boolean` で十分。

## 変更ファイル

### 1. `apps/web/src/features/auth/auth-context.ts`

- `AuthPendingMode` 型を削除
- `AuthState.pendingMode` → `AuthState.isPending: boolean`

### 2. `apps/web/src/features/auth/auth-provider.tsx`

- `useState<AuthPendingMode | null>(null)` → `useState(false)`
- `setPendingMode("sign-in")` / `setPendingMode("sign-up")` → `setIsPending(true)`
- `setPendingMode(null)` → `setIsPending(false)`
- `AuthPendingMode` import を削除
- `pendingMode` → `isPending` にリネーム

### 3. `apps/web/src/features/auth/components/auth.tsx`

- `AuthSubmitButton`: `state.pendingMode !== null` → `state.isPending`、`state.pendingMode === "sign-in" ? "Signing in..." : "Sign in"` → `state.isPending ? "Signing in..." : "Sign in"`
- `AuthCreateAccountButton`: 同様に `state.isPending` を使用

## テストへの影響

`auth.test.tsx` はボタンテキスト（`"Signing in..."`、`"Creating..."`、`"Sign in"`）でアサーションしているため、**テスト変更は不要**。

## 検証

```bash
bun run check-types --filter=web
bun run test --filter=web
```
