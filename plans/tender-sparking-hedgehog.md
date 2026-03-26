# Composition Pattern リファクタリング計画

## Context

現在の `apps/web` は初期段階で、コンポーネントは6つのみ。boolean props や forwardRef などの anti-pattern は存在しないが、LoginForm が sign-in/sign-up の両方を単一コンポーネントで処理し、状態が内部に閉じ込められている。Vercel Composition Patterns のルールに従い、全コンポーネントをリファクタリングして今後のプロジェクトルールとする。

**React 19 + Next.js 16環境** — `use()` を `useContext()` の代わりに使用、`forwardRef` は不要。

---

## 適用するルール

| ルール                               | 適用先                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| 1.1 Avoid Boolean Prop Proliferation | LoginForm の sign-in/sign-up 分岐を明示的な variant に分割 |
| 1.2 Use Compound Components          | LoginForm を compound component に                         |
| 2.1 Decouple State from UI           | State を Provider に分離                                   |
| 2.2 Generic Context Interface        | state/actions/meta の汎用インターフェース定義              |
| 2.3 Lift State into Provider         | LoginForm の state を AuthProvider にリフト                |
| 3.1 Explicit Component Variants      | SignInComposer / SignUpComposer を明示的な variant として  |
| 3.2 Children over Render Props       | —（render props は使用されていない）                       |
| 4.1 React 19 APIs                    | `use()` を使用、`forwardRef` は不使用（確認済み）          |

---

## 実装計画

### Step 1: Auth Context Interface 定義

**新規ファイル**: `apps/web/src/components/auth/auth-context.ts`

```tsx
// state / actions / meta の汎用インターフェース
interface AuthState {
	email: string;
	password: string;
	error: string | null;
	pendingMode: AuthMode | null;
}

type AuthMode = "sign-in" | "sign-up";

interface AuthActions {
	update: (updater: (state: AuthState) => AuthState) => void;
	signIn: () => Promise<void>;
	signUp: () => Promise<void>;
}

interface AuthMeta {
	displayedError: string | null;
	googleAuthUrl: string;
	appleAuthUrl: string;
}

// Context = createContext<AuthContextValue | null>(null)
```

### Step 2: Auth Provider（State 管理）

**新規ファイル**: `apps/web/src/components/auth/auth-provider.tsx`

- `useState` で state 管理
- API 呼び出しロジックを Provider に移動
- `AuthContext` に state/actions/meta を提供
- ルーター操作も Provider 内で実行

### Step 3: Auth Compound Components

**新規ファイル**: `apps/web/src/components/auth/auth.tsx`

以下の sub-component を `Auth` オブジェクトとして export:

| Component                  | 役割                                            |
| -------------------------- | ----------------------------------------------- |
| `Auth.Provider`            | Context を提供（auth-provider.ts から再export） |
| `Auth.Frame`               | `<form>` ラッパー                               |
| `Auth.EmailField`          | Email 入力フィールド                            |
| `Auth.PasswordField`       | Password 入力フィールド                         |
| `Auth.Error`               | エラーメッセージ表示                            |
| `Auth.SubmitButton`        | Sign-in ボタン（pending テキスト表示付き）      |
| `Auth.CreateAccountButton` | Sign-up ボタン（pending テキスト表示付き）      |
| `Auth.OAuthLinks`          | Google/Apple OAuth リンク群                     |

各 sub-component は `use(AuthContext)` で state/actions/meta を取得。

### Step 4: 明示的な Variant Components

**新規ファイル**: `apps/web/src/components/auth/sign-in-form.tsx`
**新規ファイル**: `apps/web/src/components/auth/sign-up-form.tsx`

```tsx
// sign-in variant
function SignInForm() {
	return (
		<Auth.Provider>
			<Auth.Frame>
				<Auth.EmailField />
				<Auth.PasswordField />
				<Auth.Error />
				<Auth.SubmitButton />
			</Auth.Frame>
		</Auth.Provider>
	);
}

// sign-up variant
function SignUpForm() {
	return (
		<Auth.Provider>
			<Auth.Frame>
				<Auth.EmailField />
				<Auth.PasswordField />
				<Auth.Error />
				<Auth.CreateAccountButton />
			</Auth.Frame>
		</Auth.Provider>
	);
}
```

※現在の LoginPage は両方のボタンを表示しているため、既存の動作を維持するために `AuthForm` も作成（両ボタン + OAuth links を含む）。

### Step 5: SignOutButton を Compound Component に

**新規ファイル**: `apps/web/src/components/auth/sign-out-button.tsx`

- `SignOutContext` を state/actions/meta パターンで定義
- `SignOut.Provider` — state 管理と API 呼び出し
- `SignOut.Button` — ボタン UI
- `SignOut.Error` — エラー表示
- `SignOutButton` — 便利ラッパー（Provider + Button + Error をまとめたもの）

### Step 6: ページコンポーネントの更新

- `login/page.tsx` — `<LoginForm />` を `<AuthForm />` に置換
- `account/page.tsx` — 新しい `SignOutButton` import に更新

### Step 7: テスト更新

- `login-form.test.tsx` — 新しい `AuthForm`（または compound components）を使用するように更新
- `sign-out-button.test.tsx` — 新しい `SignOutButton` に更新

### Step 8: 旧ファイル削除

- `apps/web/src/app/login/login-form.tsx` → 削除
- `apps/web/src/app/sign-out-button.tsx` → 削除

---

## ファイル一覧

| 操作 | ファイルパス                                                 |
| ---- | ------------------------------------------------------------ |
| 新規 | `apps/web/src/components/auth/auth-context.ts`               |
| 新規 | `apps/web/src/components/auth/auth-provider.tsx`             |
| 新規 | `apps/web/src/components/auth/auth.tsx`                      |
| 新規 | `apps/web/src/components/auth/sign-in-form.tsx`              |
| 新規 | `apps/web/src/components/auth/sign-up-form.tsx`              |
| 新規 | `apps/web/src/components/auth/sign-out-button.tsx`           |
| 新規 | `apps/web/src/components/auth/index.ts`                      |
| 修正 | `apps/web/src/app/login/page.tsx`                            |
| 修正 | `apps/web/src/app/account/page.tsx`                          |
| 修正 | `apps/web/src/__tests__/components/login-form.test.tsx`      |
| 修正 | `apps/web/src/__tests__/components/sign-out-button.test.tsx` |
| 削除 | `apps/web/src/app/login/login-form.tsx`                      |
| 削除 | `apps/web/src/app/sign-out-button.tsx`                       |

---

## 検証

1. `pnpm --filter web test` — 全テストがパスすること
2. `pnpm --filter web check-types` — 型チェックがパスすること
3. `pnpm --filter web lint` — リントがパスすること
4. `pnpm --filter web build` — ビルドが成功すること
