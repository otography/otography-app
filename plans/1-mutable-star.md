# 早期アクセス予約（ウェイトリスト）フォーム実装計画

## Context

LP の「無料ではじめる」ボタン（Header / Hero / FinalCta の3箇所）を、早期アクセス予約のメールアドレス入力フォームに置き換える。プロダクトをプレローンチ状態にし、公開前に見込みユーザーのメールアドレスを自社 DB に収集する。SaaS（GetWaitlist 等）は使わず、既存の Hono API + Drizzle + RLS 基盤で自前実装する。

**ユーザー確定事項:**

- UI: Hero と FinalCta にメール入力+送信ボタンを常時インライン表示。Header のボタンは Hero フォームへのアンカーリンク（`#early-access`）に変更
- 完全プレローンチ化: LP から /login・/account への導線をすべて撤去（ページ自体は URL 直打ちで残す）
- 重複メール: 成功として扱う（メール存在の外部漏洩防止。DB は unique 制約 + `onConflictDoNothing`）
- 確認メール送信は今回スコープ外（DB 保存 + 画面上の完了メッセージのみ）
- 分析用に `source`（`"hero" | "final_cta"`）を記録

**調査で判明した重要事実:**

- `apps/web/proxy.ts` の `PUBLIC_PATHS = ["/login", "/signup"]` に `/` が含まれず、Cookie なし訪問者は `/` → `/login` にリダイレクトされる。**proxy 修正が必須**
- ロール権限は `migrations/20260505033314_runtime-role-grants/migration.sql` でテーブルごとに明示 GRANT。新テーブルには `GRANT INSERT ... TO anon` を手動で追加する必要がある
- anon に SELECT 権限を与えないため、insert で **`.returning()` は使えない**（RETURNING は SELECT 権限が必要）
- Drizzle Studio は `DATABASE_DIRECT_URL`（owner 接続、RLS バイパス）なので SELECT ポリシーなしでも運用上データは読める
- `__tests__/shared/db/schema.db.test.ts` はテーブル名の IN リストと `toHaveLength(12)` をハードコード → 13 に更新必要
- Hono RPC はハイフン付きパスのため web 側は `api["early-access"].$post(...)` とブラケットアクセス
- `wrangler.jsonc` の `ratelimits` 配列はトップレベルと各 env ブロックに重複定義されており、**全箇所に追加**が必要

## Phase 1 — DB スキーマ + マイグレーション（TDD: \*.db.test.ts）

テストリスト:

1. `early_access_signups` が RLS 有効テーブル一覧に含まれる（count 13）— `schema.db.test.ts`
2. anon ロールで INSERT できる — `rls.db.test.ts`
3. anon で重複メールを `onConflictDoNothing` 付き INSERT してもエラーにならず、owner 接続で見ると1行のまま — `rls.db.test.ts`
4. anon は SELECT できない（権限なし → `RlsError`）— `rls.db.test.ts`

手順:

1. **Red**: `apps/api/src/__tests__/shared/db/schema.db.test.ts` の IN リストに `'early_access_signups'` を追加、`toHaveLength(12)` → `13`。`just db-start && bun run test:db --filter=api` で失敗確認
2. **Green**: `apps/api/src/shared/db/schema.ts` に追加:

```ts
/** @db-schema */
export const earlyAccessSourceEnum = pgEnum("early_access_source", ["hero", "final_cta"]);

// 事前登録（ウェイトリスト）のメールアドレス
export const earlyAccessSignups = pgTable.withRLS(
  "early_access_signups",
  {
    id: uuidV7("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    source: earlyAccessSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  () => [
    // SELECT ポリシーなし: 読み取りは owner 直結（Drizzle Studio）のみ
    pgPolicy("early_access_signups_insert_public", {
      for: "insert",
      to: [anonRole, authenticatedRole],
      withCheck: sql`true`,
    }),
  ],
);
```

3. `cd apps/api && bun run db:generate` でマイグレーション生成後、生成された `migration.sql` に**手動で追記**（`--> statement-breakpoint` 区切り）:

```sql
GRANT USAGE ON TYPE public.early_access_source TO anon, authenticated;
--> statement-breakpoint
GRANT INSERT ON TABLE public.early_access_signups TO anon, authenticated;
```

4. **Red → Green**: `rls.db.test.ts` に anon ケース3件を追加し、`bun run test:db --filter=api` を通す

## Phase 2 — API feature `apps/api/src/features/early-access/`

構成は既存 feature（`post-likes/` 等）と同じ: `model.ts` / `repository.ts` / `usecase.ts` / `route.ts` / `index.ts`。公開 POST の前例は `features/auth/route.ts` の sign-up（`csrfProtection` + `rateLimitByIp` + arktypeValidator）。

テストリスト（route: `__tests__/features/early-access/route.test.ts`、`auth/sign-up.test.ts` を雛形に rate-limit ミドルウェアをパススルーでモック + usecase をモック + `testRequest` 使用）:

1. usecase 成功時 200 + `{ message }`、usecase に正規化済み `{ email, source }` が渡る
2. 不正メール（`"not-an-email"`）で 400 problem+json
3. `source` が `"hero" | "final_cta"` 以外で 400
4. `"  Foo@Example.COM "` → `"foo@example.com"` に trim/lowercase されて usecase に届く
5. usecase が `DbError` を返すと 500 problem+json

テストリスト（usecase: `usecase.test.ts`、`posts/usecase.test.ts` を雛形に `withAnonymousRole.mockImplementation(async (_db, fn) => await fn(tx))` + repository モック）: 6. 成功: repository が anon トランザクション内で呼ばれ `{ message }` を返す 7. repository が `DbError` を返すとそのまま返す（statusCode 保持）8. `withAnonymousRole` が `RlsError` を返すと `toDbError` 経由で 500 `DbError`

実装スケッチ:

`model.ts`（メール正規化は `auth/route.ts:19-22` と同じ）:

```ts
import { type } from "arktype";

// 事前登録リクエストのスキーマ
export const earlyAccessSignupSchema = type({
  email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
  source: "'hero' | 'final_cta'",
});
export type EarlyAccessSignupInput = typeof earlyAccessSignupSchema.infer;
```

`repository.ts` — **`.returning()` 禁止**（anon に SELECT 権限なし）:

```ts
export const insertEarlyAccessSignup = async (
  tx: DatabaseTransaction,
  input: EarlyAccessSignupInput,
) => {
  // 重複メールは成功扱い（存在有無を漏らさない）: unique 制約 + DO NOTHING
  const result = await tx
    .insert(earlyAccessSignups)
    .values(input)
    .onConflictDoNothing({ target: earlyAccessSignups.email })
    .catch((e) => toDbError(e, "事前登録の保存に失敗しました。"));
  if (result instanceof Error) return result;
};
```

`usecase.ts`: `resolveDatabase`（各 feature ローカル定義の1行、`post-likes/usecase.ts` 参照）→ `withAnonymousRole(db, tx => insertEarlyAccessSignup(tx, input))` → `instanceof Error` なら `toDbError` → 成功なら `{ message: "Registered for early access." }`

`route.ts`:

```ts
const earlyAccess = new Hono<{ Bindings: Bindings }>().post(
  "/api/early-access",
  csrfProtection(),
  rateLimitByIp("EARLY_ACCESS_RATE_LIMITER"),
  arktypeValidator("json", earlyAccessSignupSchema, (result, c) => {
    if (!result.success) return badRequestResponse(c, "メールアドレスの形式が正しくありません。");
  }),
  async (c) => {
    const result = await registerEarlyAccess(c.req.valid("json"), c.var.db);
    if (result instanceof Error) return respondWithError(result, c);
    return c.json(result, 200); // 重複でも同一レスポンス
  },
);
```

配線:

- `apps/api/src/index.ts`: import + `.route("/", earlyAccess)`（`authSessionMiddleware` のパスには**追加しない** = 公開のまま。`dbMiddleware` は `/api/*` 全体に適用済み）
- `apps/api/src/shared/types/bindings.ts`: `EARLY_ACCESS_RATE_LIMITER: RateLimit;` 追加
- `apps/api/wrangler.jsonc`: `{ "name": "EARLY_ACCESS_RATE_LIMITER", "namespace_id": "1006", "simple": { "limit": 5, "period": 60 } }` を**トップレベル + 全 env ブロックの ratelimits 配列**に追加

## Phase 3 — Web

テストリスト（`apps/web/src/features/landing/early-access-form.test.tsx`、`setup-profile-form.test.tsx` を雛形に。モック: `vi.mock("@/features/lib/api", () => ({ api: { "early-access": { $post: mockPost } } }))`）:

1. メール入力（label 付き `type="email"`）と送信ボタンが表示される
2. 送信で `$post` が `{ json: { email, source: "hero" } }`（source は prop 由来）で呼ばれる
3. 成功時: `role="status"`（`aria-live="polite"`）内に完了メッセージ、フォームは置き換え
4. problem+json の `detail` 付きエラー → detail 表示、input に `aria-invalid` / `aria-describedby`
5. エラーボディがパース不能 → フォールバックメッセージ
6. ネットワーク失敗（`$post` reject）→ フォールバックメッセージ
7. エラー後の再送信が機能する、pending 中はボタン disabled

新規 `early-access-form.tsx`（`"use client"`）:

- Props: `{ source: "hero" | "final_cta"; style?: StyleXStyles<...> }`
- 制御された `<input>` + `useState`（`status: "idle" | "pending" | "success"`、`error: string | null`）。fetch パターンは `auth-provider.tsx` 準拠（`.catch(→Error)` → `instanceof Error` → `res.ok` → `payload.detail`）。1フィールドなので Formisch は使わない
- ページ内に2箇所描画されるためエラーメッセージ id は `useId()`
- StyleX: pill 入力欄 + `primary-link.tsx` と同じ見た目のボタン（`linear-gradient(180deg, #222631 0%, #11151d 100%)`、`borderRadius: "999px"`、`minHeight: "3.25rem"`）。640px 以下で縦積み
- 文言（実装時に調整可）: ボタン「事前登録する →」、成功「ご登録ありがとうございます。公開時にメールでお知らせします。」

コンポーネント変更:

- `hero.tsx`: `ctaHref` prop 削除。`PrimaryLink` → `<EarlyAccessForm source="hero" />`。actions コンテナに `id="early-access"`（`scrollMarginTop` 付き）。`#how-it-works` の「もっと知る」リンクは残す
- `final-cta.tsx`: `ctaHref` 削除、`<EarlyAccessForm source="final_cta" />`。小テキスト「アカウント登録なしでも閲覧できます」→「メールアドレスは公開のお知らせにのみ利用します」等に差し替え
- `primary-link.tsx`: 汎用 pill リンクに変更（props を `{ href, children, style? }` にし「無料ではじめる」のハードコードを除去）。header からのみ使用継続
- `header.tsx`: `ctaHref` 削除、`<PrimaryLink href="#early-access">事前登録 →</PrimaryLink>`。モバイルメニュー（CTA は 640px 以下で非表示のため）に「事前登録」項目を追加
- `apps/web/src/app/page.tsx`: `getCurrentUser` / `getCtaHref` / `NoProfileError` を削除し、同期コンポーネント化
- `apps/web/proxy.ts`: `if (pathname === "/") return NextResponse.next();` を追加（**完全一致**。`startsWith` リストに `/` を入れると全パスにマッチするため不可）
- `apps/web/src/app/page.test.tsx`: `getCurrentUser` モックと href アサーションを削除。メール入力2箇所・header の `#early-access` リンク・「無料ではじめる」リンク不在をアサート。`render(await Home())` → `render(<Home />)`

Web の TDD 順序: form テスト 1–7 を先に red/green → その後 `page.test.tsx` を更新（red: 旧 CTA 期待で落ちる → green: page/コンポーネント書き換え）

## Phase 4 — 検証

```bash
bun run test --filter=api                        # route/usecase ユニット
just db-start && bun run test:db --filter=api    # マイグレーション + RLS 統合
bun run test --filter=web
bun run check-types
bun run lint && bun run format
bun run check-dead-code                          # knip: enum は @db-schema タグで除外済み
bun run quality
```

手動 E2E: `cd apps/api && bun run db:migrate` → `bun run dev` → **シークレットウィンドウ（Cookie なし）**で `http://localhost:3000` を開く（proxy 修正の確認）→ Hero / FinalCta から送信 → 同一メール再送信で同じ成功表示 → `bun run db:studio` で行と `source` 値を確認

## リスク / 注意点

- **wrangler.jsonc の ratelimits 三重定義**: env ブロックへの追加漏れは `wrangler dev` / preview で実行時 TypeError（binding undefined）になるまで気づけない
- **GRANT 追記漏れ**: `GRANT INSERT` / `GRANT USAGE ON TYPE` がないと全 insert が permission denied。ユニットテストでは検出できず DB テストのみで検出。`db:generate` を再実行するとマイグレーションが作り直され追記が消えるので注意
- **anon での `.returning()` は 500**（SELECT 権限なし）— rls.db テストがガード
- **CSRF**: デプロイ環境では Origin が `APP_FRONTEND_URL` と一致する必要あり（同一オリジンリライト経由の RPC クライアントなら問題なし）
- **StyleX**: `source` prop から動的スタイル値を作らない。`fontTokens` は `tokens.stylex.ts` から import（クロスファイル文字列定数は暗黙に落ちる）
