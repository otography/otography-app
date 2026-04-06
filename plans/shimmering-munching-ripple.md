# `@hono/arktype-validator` 導入

## Context

現状、API でのリクエストボディバリデーションは各ハンドラー内で手動（`readCredentials()` + `instanceof type.errors`）で行っている。公式の `@hono/arktype-validator` ミドルウェアを導入し、バリデーションを宣言的にミドルウェアチェーンに移すことで、ハンドラーを純粋なビジネスロジックに集中させる。

## 変更範囲

| ファイル                                               | 変更内容                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `apps/api/package.json`                                | `@hono/arktype-validator` 追加                                             |
| `apps/api/src/features/auth/route.ts`                  | スキーマ強化、validator ミドルウェア導入、ハンドラー簡素化、不要コード削除 |
| `apps/api/src/__tests__/features/auth/sign-in.test.ts` | 入力バリデーションテスト追加                                               |
| `apps/api/src/__tests__/features/auth/sign-up.test.ts` | 入力バリデーションテスト追加                                               |

**変更なし:** `index.ts`, `firebase-rest.ts`, `db/schema.ts`, `middleware/*`, `hono.d.ts`

## 実装手順

### 1. パッケージ追加

```bash
bun add @hono/arktype-validator --filter=api
```

### 2. `apps/api/src/features/auth/route.ts` を修正

#### 2a. スキーマを強化 — email形式とpassword長をschemaに統合

```ts
// Before
const credentialsBodySchema = type({ email: "string", password: "string" });
const emailSchema = type("string.email");

// After
const credentialsBodySchema = type({
  email: "string.email",
  password: "string >= 6",
});
```

#### 2b. validator ミドルウェア定義 — 既存のエラー形式を維持

```ts
import { arktypeValidator } from "@hono/arktype-validator";

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
  if (!result.success) {
    return c.json(
      {
        message: "Please provide a valid email address and a password with at least 6 characters.",
      },
      400,
    );
  }
});
```

#### 2c. ハンドラーを `c.req.valid("json")` に変更

```ts
// Before
const signInHandler = async (c: Context) => {
	const credentials = await readCredentials(c);
	if (!credentials) { return c.json({ message: "..." }, 400); }
	const result = await signInWithPassword(c, credentials.email, credentials.password);
	...
};

// After
const signInHandler = async (c: Context) => {
	const { email, password } = c.req.valid("json");
	const normalizedEmail = email.trim().toLowerCase();
	const result = await signInWithPassword(c, normalizedEmail, password);
	...
};
```

`signUpHandler` も同様。

#### 2d. ルートチェーンに validator 追加

```ts
.post("/api/auth/sign-in", csrfProtection(), credentialsValidator, signInHandler)
.post("/api/auth/sign-up", csrfProtection(), credentialsValidator, signUpHandler)
```

#### 2e. 削除: `emailSchema`, `readCredentials()`

### 3. テスト追加

sign-in と sign-up の両方に `input validation` describe ブロックを追加:

- email 欠落 → 400
- email 形式不正 → 400
- password 6文字未満 → 400

既存テストは有効な credentials を送っているため変更不要。

## 検証

```bash
bun run check-types --filter=api    # TypeScript エラーなし
bun run check-types --filter=web    # Hono RPC 型推論確認
bun run test --filter=api           # 全テスト通過
bun run lint --filter=api           # リント通過
```
