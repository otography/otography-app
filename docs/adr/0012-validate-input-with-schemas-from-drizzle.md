# API の入力の検証には、drizzle のスキーマから作った zod のスキーマを使う

API の入力を検証する zod のスキーマは、手で書かず、`drizzle-orm/zod` の `createInsertSchema` と `createSelectSchema` で drizzle のテーブル定義から作る。列の型や文字数の上限は、drizzle のテーブル定義と `packages/db/src/constants.ts` の定数にだけ書く。検証の規則を書く場所が 2 か所（zod のスキーマと DB の定義）あると、片方だけを変えたときに、API が受け付ける値と DB が保存できる値が食い違うからである。

## 前提

- `drizzle-orm/zod` は、列の型、NOT NULL、`text({ length })` から zod のスキーマを作る。`length` を指定した `text` 列は、文字数の上限の検証になる（2026-11-17 に確認）。
- `drizzle-orm/zod` は、CHECK 制約を zod のスキーマに反映しない。
- SQLite は `text(140)` の長さを守らない。文字数の上限を DB で守るには、CHECK 制約が必要である。
- SQLite の `length()` は、文字数をコードポイントで数える。`drizzle-orm/zod` が作る上限の検証も、コードポイントで数える（2026-11-17 に、絵文字 140 個が通り、141 個が通らないことを確認した）。

## 理由

### 1. 規則を 1 か所に書けば、API と DB の規則が食い違わない

- たとえば、本文の上限を 140 文字から 200 文字に変えるとき、変更する場所は `POST_CONTENT_MAX` の 1 か所である。drizzle のテーブル定義（`text({ length })` と CHECK 制約）と zod のスキーマは、どちらもこの定数から作られる。
- zod のスキーマを手で書くと、定数を使い忘れたときに、API は通すが DB の CHECK 制約で拒否される値（または、その逆）ができる。

### 2. 応答の形も、テーブル定義から作れる

- `createSelectSchema(...).pick(...)` で応答に含める列を選ぶと、`pick` に書いていない列（内部のユーザー ID など）は、`parse` のときに取り除かれる。列の型を変えたときは、応答の型も変わる。

## 実装

- 文字数の上限は、定数（`POST_CONTENT_MAX`、`ISRC_LENGTH`）を、`text({ length })` と CHECK 制約の両方に渡す（`packages/db/src/schema/posts.ts`、`music.ts`）。
- `apps/api/src/posts/schemas.ts` では、`createInsertSchema` の 2 つ目の引数で、CHECK 制約にあたる規則と入力の正規化だけを足す。
  - 本文：前後の空白を除き、空を拒否する（CHECK の `length(content) between 1 and 140` の下限にあたる）。
  - ISRC：12 文字であること（CHECK の `length(isrc) = 12` にあたる）と、大文字への変換。
- 他のテーブルの列を入力に含めるときは、そのテーブルのスキーマの `shape` から取る（例：`songId` は `songs.appleSongId` の列のスキーマ）。
- `drizzle-orm/zod` は、NULL 可の列のスキーマを、2 つ目の引数で上書きした後にも NULL 可にする。そのため、DB では NULL 可だが API では必須の値（`posts.song_isrc`）は、NOT NULL の列（`songs.isrc`）のスキーマから取る。

## 検討した他の案

- **API の入力の zod のスキーマを手で書く**：理由 1 のとおり、規則を書く場所が 2 か所になるので、採用しない。

## この決定による影響

- 本文の上限はコードポイントで数えるので、複数のコードポイントからなる絵文字（肌の色を指定した絵文字、家族の絵文字など）は、1 つで 2 文字以上として数える。
- `trim()` は、`drizzle-orm/zod` が付けた上限の検証の後に実行される。そのため、前後の空白を含めて上限を超える本文は、空白を除けば上限以下でも拒否される。
- CHECK 制約を変えるには、マイグレーションが必要である。SQLite は CHECK 制約を変更できないので、drizzle-kit はテーブルを作り直すマイグレーションを作る。
