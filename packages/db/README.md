# db

Turso（libSQL）＋ Drizzle ORM v1 のスキーマとマイグレーション。ビルドはせず、`src/index.ts` を直接 import する。

## 構成

- `src/schema/`：テーブル定義。`snakeCase.table()` で、DB の列名はスネークケース、JS のキーはキャメルケース
- `src/relations.ts`：`defineRelations()` によるリレーション
- `src/constants.ts`：お気に入りの上限や埋め込みの次元数などの定数
- `migrations/`：`drizzle-kit generate` が出力するマイグレーション

## コマンド

```bash
vp run db#db:generate -- --name=<名前>  # スキーマの変更からマイグレーションを作る
vp run db#db:migrate                    # TURSO_DATABASE_URL（既定は turso dev の http://127.0.0.1:8080）に適用
vp run db#db:check                      # マイグレーションの整合性を確認
vp test                                 # メモリ上の libSQL にマイグレーションを当ててテスト
```

## 認証テーブル（Better Auth）

`src/schema/auth.ts` は `auth generate` の出力を土台に、書き方を `snakeCase.table()` に揃え、独自のインデックスと CHECK 制約を足したもの。
Better Auth の設定やバージョンを変えたときは、次の手順で照合する。

1. `npx auth@latest generate --output <一時ファイル>` の出力と `auth.ts` の差分を見て、列の追加などを反映する
2. `npx auth@latest check schema --config <auth の設定ファイル>` で照合する

アダプターは `@better-auth/drizzle-adapter/relations-v2` を `{ provider: "sqlite", usePlural: true, schema }` で使う。
