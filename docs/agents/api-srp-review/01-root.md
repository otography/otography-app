# 01 — ルートファイル SRPレビュー

**対象ファイル**:

- `src/index.ts`
- `src/client.ts`
- `src/env.drizzle.ts`

## 結果サマリー

| ファイル         | SRP | 合成性 | 判定                 |
| ---------------- | --- | ------ | -------------------- |
| `index.ts`       | ✅  | ⚠️     | 改善余地あり（軽微） |
| `client.ts`      | ✅  | ✅     | 問題なし             |
| `env.drizzle.ts` | ✅  | ✅     | 問題なし             |

## 詳細

### `src/index.ts`

**責務**: アプリケーションのコンポジションルート。ミドルウェアチェーンの構築とfeature サブルーターのマウント、`AppType` のエクスポート。

**SRP評価**: ✅ — コンポジションルートとして、ビジネスロジックを一切持たず全てfeature/shared に委譲している。

**合成性評価**: ⚠️ — 以下の軽微な問題あり。

**問題点**:

1. **インラインCORSファクトリ（行20-28）**: CORS設定がインラインの矢印関数として定義されている。`c.env` がリクエスト時しか利用できないためインライン化が必要だが、`corsMiddleware(c, next)` のような名前付き関数に抽出すべき。

   ```ts
   .use("/api/*", async (c, next) => {
     const middleware = cors({
       origin: c.env.APP_FRONTEND_URL,
       allowHeaders: ["Content-Type"],
       allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
       credentials: true,
     });
     return middleware(c, next);
   })
   ```

2. **`authSessionMiddleware()` の7回繰り返し（行30-37）**: 同じミドルウェアが7つのプレフィックスに対して個別登録されている。新規protected feature 追加時に `index.ts` の修正が必要。
   ```ts
   .use("/api/auth/*", authSessionMiddleware())
   .use("/api/apple-music/*", authSessionMiddleware())
   .use("/api/posts/*", authSessionMiddleware())
   .use("/api/user/*", authSessionMiddleware())
   .use("/api/artists/*", authSessionMiddleware())
   .use("/api/songs/*", authSessionMiddleware())
   .use("/api/me/*", authSessionMiddleware())
   ```

**推奨される改善**:

1. CORS を `shared/middleware/cors.middleware.ts` に抽出し `corsMiddleware(c, next)` として公開。
2. 各feature ルーター内で `authSessionMiddleware` をマウントする（feature が自分の認証要件を所有する設計）。またはパス配列マッチャーで集約。
3. （任意）protected prefix の宣言的テーブル（`PROTECTED_PREFIXES` 配列）で繰り返しを排除。

---

### `src/client.ts`

**責務**: `AppType` の型再エクスポート（webアプリ向け）。

**SRP**: ✅ / **合成性**: ✅ — 3行の純粋な型re-export。問題なし。

---

### `src/env.drizzle.ts`

**責務**: drizzle-kit CLIコマンド向けの最小envオブジェクト（`DATABASE_URL`, `DATABASE_DIRECT_URL`）。

**SRP**: ✅ / **合成性**: ✅ — アプリ全体のenv（`@t3-oss/env-nextjs` + valibot）から意図的に分離された、マイグレーション専用のエントリポイント。

**軽微な所見**: `process.env.DATABASE_URL!` の非nullアサーションが、env未設定時に分かりにくいエラーを生成する可能性。CLI専用なので許容範囲だが、fail-fastガードを追加するとより親切。
