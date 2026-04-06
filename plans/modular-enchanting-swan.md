# 認証基盤の移行計画: Supabase Auth → Firebase Auth Session Cookies + Drizzle ORM

## Context

現状は `apps/web` と `apps/api` の両方が `@supabase/ssr` に依存しており、認証境界が曖昧になっている。これにより以下の問題がある。

1. **信頼境界の崩れ**: Next.js 側でも認証 SDK とセッション解釈を持っている
2. **Supabase SDK 依存**: DB が Supabase-hosted Postgres でなくても使えるのに、実装が Supabase Auth に引きずられている
3. **DB 非抽象化**: RLS が未整備で、認証済みユーザー文脈を安全に DB へ伝播できていない
4. **将来の差し替えコスト**: Auth provider や DB provider を入れ替える際に、フロント・API・DB の全部に変更が波及する

今回の前提は次の通り。

- `apps/api` のみを信頼できるコンポーネントとする
- Next.js は信頼境界の外側に置く
- フロントエンドは Firebase SDK / Supabase SDK / DB 接続情報を持たない
- API が認証・セッション・RLS 文脈の正規化を一手に引き受ける

---

## 目標

- `@supabase/ssr` / `@supabase/supabase-js` への依存を完全に削除する
- Firebase Auth を `apps/api` 主導で導入する
- ブラウザには `HttpOnly` セッション Cookie のみを見せる
- DB 層は Firebase 固有情報ではなく、正規化済み claims (`sub`, `role`) だけを受け取る
- Drizzle ORM + PostgreSQL の RLS を有効化し、Supabase-hosted Postgres / self-hosted Postgres のどちらでも成立する設計にする

---

## アーキテクチャ

```
┌─────────────────────┐     ┌────────────────────────────┐     ┌──────────────────────┐
│      Frontend       │     │        apps/api            │     │      PostgreSQL      │
│  (Next.js / UIのみ) │────▶│ Firebase Auth + Session    │────▶│ Drizzle + RLS        │
│                     │     │ Cookies + Hono + Drizzle   │     │ (Supabase可 / 汎用)  │
└─────────────────────┘     └────────────────────────────┘     └──────────────────────┘
          │                               │                                 │
          │ email/password                │ verify session cookie            │ set_config()
          │ credentials: include          │ normalize claims                 │ sub, role
          ▼                               ▼                                 ▼
```

重要な点:

- ブラウザは Firebase に直接ログインしない
- ブラウザは ID token / refresh token を保持しない
- Next.js は API に Cookie を転送して「現在のユーザー」を問い合わせるだけ
- Firebase 固有の検証は API で完結し、DB は `request.jwt.claims` の `sub` を使って RLS を評価する

---

## 実装計画

### Phase 1: 依存関係と環境変数の更新

#### 1.1 依存関係

```bash
# apps/api
bun remove @supabase/ssr @supabase/supabase-js
bun add firebase-admin

# apps/web
bun remove @supabase/ssr @supabase/supabase-js
```

補足:

- フロントには `firebase` SDK を入れない
- Firebase との通信は `apps/api` に閉じ込める

#### 1.2 環境変数

```typescript
// apps/api/src/env.ts
export const env = createEnv({
  server: {
    DATABASE_URL: type("string.url"),
    FIREBASE_PROJECT_ID: type("string>0"),
    FIREBASE_API_KEY: type("string>0"),
    FIREBASE_CLIENT_EMAIL: type("string.email"),
    FIREBASE_PRIVATE_KEY: type("string>0"),
    APP_FRONTEND_URL: type("string.url"),
    AUTH_COOKIE_DOMAIN: type("string>0 | undefined"),
    PORT: type("string.numeric.parse | undefined"),
  },
});
```

追加で補うべき点:

- `AUTH_COOKIE_DOMAIN` を任意で持たせる
- `web` と `api` が sibling subdomain のときは cookie domain を共有する
- `web` 側は `NEXT_PUBLIC_API_URL` だけを持つ

---

### Phase 2: API 主導の Firebase セッション

#### 2.1 サインイン / サインアップ

`apps/api` が Firebase Auth REST API (`accounts:signInWithPassword`, `accounts:signUp`) を呼び出す。

```text
Browser -> apps/api -> Firebase Auth REST API
```

この時点でブラウザは Firebase API key を知らない。

#### 2.2 セッション Cookie 発行

Firebase Admin SDK を使って ID token から session cookie を生成し、`HttpOnly` cookie として返す。

```typescript
const sessionCookie = await firebaseAuth.createSessionCookie(idToken, {
  expiresIn: SESSION_COOKIE_MAX_AGE_MS,
});
```

これにより:

- フロントは ID token の更新や保存を気にしなくてよい
- Next.js が中継しても token refresh の取り回しで破綻しにくい
- セッション寿命を API 側で統一管理できる

#### 2.3 セッション検証

`apps/api` の middleware で `verifySessionCookie()` を実行し、Hono Context に正規化済み claims を載せる。

```typescript
c.set("authSession", { claims, sessionCookie });
c.set("jwtPayload", claims);
c.set("userId", claims.uid);
```

#### 2.4 CORS / CSRF

plan に不足していた項目:

- `apps/web -> apps/api` の cross-origin fetch 用に `cors()` が必要
- cookie ベース認証に変わるため、`POST` エンドポイントには CSRF 保護が必要

---

### Phase 3: Firebase 依存を API に閉じ込める正規化層

DB とアプリ本体は Firebase 固有の `iss` / `aud` / provider 情報に直接依存しない。

API でのみ Firebase を理解し、DB には以下のような正規化された claims を渡す。

```json
{
  "sub": "firebase-uid",
  "role": "authenticated",
  "email": "user@example.com"
}
```

この補足が重要:

- Firebase-specific validation は API 層の責務
- DB 層に Firebase-specific な SQL 関数を埋め込むと、Auth provider 差し替えが難しくなる
- 将来 Auth0 / Cognito / 独自 Auth に変えても、API の正規化層だけ差し替えれば済む

---

### Phase 4: RLS 用 PostgreSQL 基盤

#### 4.1 GUC 関数

```sql
create or replace function public.requesting_user_id()
returns text as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ language sql stable;
```

#### 4.2 RLS 付き transaction helper

```typescript
await tx.execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`);
await tx.execute(sql.raw("set local role authenticated"));
```

#### 4.3 汎用 Postgres 向けロールと権限

plan に不足していた項目:

- `authenticated` ロールが存在しない Postgres でも動くように、migration で作成する
- `grant authenticated to current_user;` を行い、runtime user が `set local role authenticated` できるようにする
- テーブル権限 (`grant select, insert, update`) を明示する
- `alter table ... force row level security;` で owner bypass を防ぐ

---

### Phase 5: profiles テーブルと RLS ポリシー

```typescript
const authenticatedRole = pgRole("authenticated").existing();

export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name"),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    pgPolicy("profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = requesting_user_id()`,
    }),
    pgPolicy("profiles_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.id} = requesting_user_id()`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = requesting_user_id()`,
      withCheck: sql`${table.id} = requesting_user_id()`,
    }),
  ],
);
```

plan の抜け漏れ:

- `insert` policy がないと初回ログイン時の upsert が失敗する
- `returning()` を使うなら `select` 権限も必要
- `updatedAt` を API 側 upsert で更新する必要がある

---

### Phase 6: API ルート

必要なエンドポイント:

- `POST /api/auth/sign-in`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-out`
- `GET /api/user`

`GET /api/user` は profile を upsert して返す。
これにより、フロントは「現在のユーザーを API に問い合わせる」だけで済む。

---

### Phase 7: Next.js 側の責務縮小

#### 7.1 削除するもの

- `apps/web/lib/supabase/*`
- `@supabase/ssr`
- `@supabase/supabase-js`
- Firebase SDK 直接利用

#### 7.2 残す責務

- ログインフォームを表示する
- `credentials: "include"` で API に POST する
- API から `GET /api/user` を呼ぶ
- `proxy.ts` は API に問い合わせて 401 の時だけ `/login` に寄せる

#### 7.3 やらないこと

- Next.js で Firebase token を検証しない
- Next.js で DB に直接接続しない
- Next.js で session cookie を生成しない

---

## 変更対象ファイル

| ファイル                                            | 変更内容                                    |
| --------------------------------------------------- | ------------------------------------------- |
| `apps/api/src/env.ts`                               | Firebase / cookie 用 env 追加               |
| `apps/api/src/shared/auth.types.ts`                 | 認証 claims / session の型定義              |
| `apps/api/src/shared/firebase-admin.ts`             | Firebase Admin 初期化                       |
| `apps/api/src/shared/firebase-rest.ts`              | Firebase Auth REST 呼び出し                 |
| `apps/api/src/shared/session.ts`                    | session cookie ヘルパー                     |
| `apps/api/src/shared/types/hono.d.ts`               | Hono Context 拡張                           |
| `apps/api/src/shared/middleware/auth.middleware.ts` | session cookie 検証 middleware              |
| `apps/api/src/shared/db/rls.ts`                     | RLS helper                                  |
| `apps/api/src/shared/db/schema.ts`                  | `profiles` と RLS policy                    |
| `apps/api/src/features/auth/route.ts`               | sign-in / sign-up / sign-out / current user |
| `apps/api/drizzle.config.ts`                        | schema / migrations パス修正                |
| `apps/api/.env.example`                             | Firebase + cookie 設定に更新                |
| `apps/web/src/env.ts`                               | API URL のみ残す                            |
| `apps/web/proxy.ts`                                 | API 問い合わせベースの route guard へ変更   |
| `apps/web/lib/current-user.ts`                      | API 経由の current user 取得                |
| `apps/web/lib/proxy-auth.ts`                        | Next.js proxy 用の API guard                |
| `apps/web/app/login/*`                              | API ベースのログイン UI                     |
| `apps/web/app/page.tsx`                             | API セッション前提のページへ変更            |

---

## 検証方法

1. **型検証**
   - `bun run check-types` を `apps/api` と `apps/web` で通す

2. **認証フロー検証**
   - `/login` で sign up
   - 同じ画面から sign in
   - `/` へ遷移し `GET /api/user` が成功することを確認
   - sign out 後に `/login` へ戻ることを確認

3. **Cookie / CORS 検証**
   - `apps/web` から `credentials: include` で API を呼べること
   - `Set-Cookie` がブラウザで保持されること
   - `APP_FRONTEND_URL` 以外の Origin からの POST が拒否されること

4. **RLS 検証**
   - ユーザー A で作成された `profiles` をユーザー B が読めないこと
   - `withRls()` を通さないクエリで意図せず読めないこと

5. **DB portability 検証**
   - Supabase-hosted Postgres でも self-hosted Postgres でも `authenticated` role / grants / `request.jwt.claims` に依存するだけで動作すること

---

## 参考リンク

- [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firebase Admin SDK](https://firebase.google.com/docs/reference/admin/node)
- [Drizzle ORM RLS](https://orm.drizzle.team/docs/rls)
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)
