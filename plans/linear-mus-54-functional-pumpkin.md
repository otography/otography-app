# MUS-54: /api/apple-music/token のセキュア化

## Context

Linear [MUS-54](https://linear.app/music-social/issue/MUS-54): `GET /api/apple-music/token` が 24h 有効な Apple Music developer token を**認証なし・レート制限なし・origin クレームなし**で配布し、`public, s-maxage=82800` でエッジキャッシュまでしている。第三者がトークンを収穫して Apple Music API クォータを消費できる状態。

ユーザー確認済みの方針:

- **近いうちに MusicKit JS を使う予定がある** → 削除ではなく、イシュー記載の3点セット（認証必須 + origin クレーム + 短 TTL）+ キャッシュ戦略見直しで堅牢化する
- API は一度も公開環境にデプロイされていない → Apple キーのローテーションは不要
- 再発防止として、個別の 404 テストではなく「API の公開サーフェス（無認証ルート）を許可リストで固定化するテスト」を追加し、認証の付け忘れというクラスのバグを構造的に防ぐ

サーバー内部用トークン（`shared/apple-music/client.ts` が songs/artists 取得に使用）は現行挙動（24h・origin なし）を維持する。

## 変更ファイル

### 1. `apps/api/src/shared/apple-music/token.ts` — Web 用トークン関数を追加

内部共通の署名関数に集約し、用途別の公開関数を分ける（options 引数ではなく別関数にすることで、Web ルートが誤って無制限トークンを発行できない設計にする）:

```ts
// 内部共通（非公開）
const signDeveloperToken = (opts: { ttlSeconds: number; origin?: string[] }) => { ... };

// サーバー内部利用（client.ts）: 24h・origin なし — 現行と完全同一
export const generateDeveloperToken = () => signDeveloperToken({ ttlSeconds: 60 * 60 * 24 });

// Web 配布用（MusicKit JS）: 1h・origin クレームで利用元を制限
export const generateWebDeveloperToken = (origins: string[]) =>
  signDeveloperToken({ ttlSeconds: 60 * 60, origin: origins });
```

`origin` は JWT ペイロードに配列で入れる（`new SignJWT({ origin: origins })`、Apple MusicKit 仕様）。`privateKeyPromise` のモジュールキャッシュは現状維持。origins はルート側から引数で渡す（env 直読みしない — テスト容易性のため）。19行目の「レスポンスのキャッシュはroute側でHono/cacheに任せる」コメントは削除（キャッシュ廃止のため）。

### 2. `apps/api/src/features/apple-music/route.ts` — ルート堅牢化

- `hono/cache` を完全削除（コードベース唯一の利用箇所）
- 既存の保護ルート規約（GET なので csrf 不要）に従う:

```ts
const appleMusic = new Hono<Env>().get(
  "/api/apple-music/token",
  requireAuthMiddleware(),
  rateLimitByUser("APPLE_MUSIC_TOKEN_RATE_LIMITER"),
  async (c) => {
    const developerToken = await generateWebDeveloperToken(
      [c.env.APP_FRONTEND_URL].filter((o) => o !== ""),
    );
    c.header("Cache-Control", "no-store");
    return c.json({ developerToken });
  },
);
```

- **キャッシュは `no-store`**。レスポンスは bearer 資格情報であり、ES256 署名は ~1ms、MusicKit はページロードごとに1回しか取得しないため共有/永続キャッシュの事故クラスごと排除するのが最善。イシュー指摘の「マージンが機能しないキャッシュ設計」も消滅する
- `requireAuthMiddleware` / `rateLimitByUser` は `shared/middleware` からインポート（既存エクスポート確認済み）

### 3. `apps/api/src/index.ts` — authSessionMiddleware スコープ追加

- 43–48行の `.use` ブロックに `.use("/api/apple-music/*", authSessionMiddleware())` を追加
- 41–42行のコメントを更新: 公開ルートは health のみ、公開サーフェスは public-surface テストの許可リストで管理する旨に書き換え

### 4. `apps/api/wrangler.jsonc` + `apps/api/src/shared/types/bindings.ts` — レートリミッター

- `ratelimits` の**3箇所すべて**（トップレベル / `env.dev` / `env.preview`）に追加:
  `{ "name": "APPLE_MUSIC_TOKEN_RATE_LIMITER", "namespace_id": "1006", "simple": { "limit": 10, "period": 60 } }`
  （1001–1005 は使用済み、1006 が次の空き。10 req/60s/user は「ページロードごとに1回」に対して十分寛容かつ収穫を阻止する値）
- `bindings.ts` に `APPLE_MUSIC_TOKEN_RATE_LIMITER: RateLimit;` を追加

### 5. `apps/api/vitest.config.ts` — テスト用 APPLE\_\* バインディング追加

`APPLE_KEY_ID: "TESTKEY1234"`, `APPLE_TEAM_ID: "TESTTEAM12"`, `APPLE_PRIVATE_KEY` に使い捨て P-256 PKCS8 PEM（実装時に `openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt` で生成。既存の FIREBASE_PRIVATE_KEY ダミーと同じ扱い）。これでテスト内で実 JWT を署名し `jose` の `decodeJwt` でペイロード検証できる。

### 6. 新規: `apps/api/src/__tests__/public-surface.test.ts` — 公開サーフェス許可リストテスト

- `app.routes` から `method !== "ALL"` をフィルタし `(method, path)` をデデュープして全エンドポイントを**動的列挙**
- パスパラメータをダミー値に置換（`:id` → 固定 UUID 等）し、Cookie なしで `testRequest` を全ルートに発行 → `PUBLIC_ROUTE_ALLOWLIST` にない限り **401 を assert**
- 逆方向 assert も追加: 許可リストの全エントリが `app.routes` に実在すること（陳腐化検出）
- 静的解析（ミドルウェアカバレッジ計算）は不採用: `authSessionMiddleware` は匿名クロージャで判別不能かつ 401 を返すのは per-route の `requireAuthMiddleware` のため、実リクエストで検証するのが確実
- 許可リスト想定（RED 実行時の実際の `app.routes` で確定）: health 2件、`GET /errors/:type`、auth 系（sign-in/sign-up/sign-out/google/google/callback）、公開 GET（songs/artists/posts/users とその favorites）。**`/api/apple-music/token` は含めない**
- DB は他テスト同様 `vi.mock("../../shared/db", ...)`。setup.ts が csrf パススルー・refresh-token null を既に用意しているので保護ルートは決定的に 401 になる

## テストリスト（t-wada TDD、RED→GREEN 順）

新規テストファイル: `__tests__/shared/apple-music/token.test.ts`, `__tests__/features/apple-music/route.test.ts`, `__tests__/public-surface.test.ts`

0. （準備・即 GREEN）vitest.config.ts に APPLE\_\* 追加 + **特性テスト**: `generateDeveloperToken()` のペイロードに `origin` がない / `exp - iat === 86400` / ヘッダー `kid` = APPLE_KEY_ID / `iss` = APPLE_TEAM_ID — token.ts に触る前にサーバー側挙動を固定
1. RED: `generateWebDeveloperToken(["http://localhost:3000"])` のペイロード `origin` が `["http://localhost:3000"]` → GREEN: token.ts 実装
2. RED: Web トークンの `exp - iat === 3600` → GREEN: TTL パラメータ
3. RED: Cookie なし `GET /api/apple-music/token` → 401（problem+json） → GREEN: index.ts `.use` + `requireAuthMiddleware()`
4. RED: 有効セッション（`mockVerifySessionCookie` パターン）→ 200、`developerToken` をデコードすると `origin` と 1h exp → GREEN: ルートが `generateWebDeveloperToken` を呼ぶ
5. RED: レスポンス `Cache-Control` が `no-store`（`public`/`s-maxage` が無いことも assert） → GREEN: `hono/cache` 削除 + ヘッダー設定
6. RED: レートリミット — `fav-artists-rate-limit.test.ts` の `createRateLimitMockEnv` パターンを流用、11回目 → 429 / 未認証は 429 でなく 401 → GREEN: wrangler.jsonc + bindings.ts + `rateLimitByUser`
7. RED: public-surface テスト（許可リスト空で実行し、失敗出力で実サーフェスを列挙） → GREEN: 意識的に確定した許可リストを固定
8. リグレッション: 全スイート（`middleware-scope.test.ts`、`client.ts` 利用の songs/artists テストが GREEN のまま）+ `bun run quality`

## E2E 検証

1. `bun run dev --filter=api`（`.dev.vars` に実 APPLE\_\* が必要）
2. `curl -i http://localhost:3001/api/apple-music/token` → **401** problem+json
3. サインインして `otography_session` Cookie を取得（web からコピーでも可）
4. Cookie 付き同 curl → **200**、`Cache-Control: no-store`、`s-maxage` なし
5. `jq -r .developerToken | cut -d. -f2 | tr '_-' '/+' | base64 -d | jq` → `origin: ["http://localhost:3000"]`、`exp - iat = 3600`、`iss` = team ID
6. 認証付きで 11 連打 → 11回目が **429**
7. サーバー内部経路の無影響確認: 曲同期（`client.ts` 経由）が従来どおり動く

## 補足・判断済み事項

- **preview 環境**: `env.preview.vars.APP_FRONTEND_URL` が `""` のため、preview では origin 無制限（ただし認証必須・1h）のトークンになる。`.filter((o) => o !== "")` で明示的に処理し、preview URL 確定時に var を設定する（イシューコメントに記録）
- **エッジキャッシュ残骸**: 公開デプロイ歴がないため Cache API のパージ・キーローテーションは不要
- **完了時**: MUS-54 にコメントで対応内容（+ 将来の web 消費者は `credentials: "include"` + 401 時の再取得が必要な旨、preview var の TODO）を記録し、ステータスを更新
