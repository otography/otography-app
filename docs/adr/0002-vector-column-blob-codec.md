# ベクトル型の列に Drizzle の codec "blob" を指定する

埋め込みベクトルの列の型（`packages/db/src/schema/columns.ts` の `float16Vector`）には、Drizzle の customType のオプション `codec: "blob"` を指定する。Drizzle v1 の公式ドキュメントは、JSON の中で列を扱うための `forJsonSelect` と `fromJson` を非推奨とし、代わりに codec を使うよう求めている。codec `"blob"` を指定すると、通常の読み出しとリレーショナルクエリの読み出しの両方で、Drizzle 組み込みの BLOB 用の変換が使われる。この 2 点が理由である。

## 前提

- 列の型は libSQL の F16_BLOB(2048) であり、データベースから読み出した値はバイト列である。
- Drizzle（v1.0.0-rc.5）は、列の値を 2 つの方法で読み出す。
  - 通常の読み出し（`select()` や、リレーショナルクエリの最上位のテーブル）では、ドライバーが返した値をそのまま受け取る。
  - リレーショナルクエリで入れ子にしたテーブル（`with`）では、SQL の中で各列の値を JSON にまとめて受け取る。SQLite の JSON は BLOB を値として持てないので、BLOB の列は文字列に変換してから JSON に入れる必要がある。
- customType の `fromDriver` は、codec による変換の後に呼ばれる（Drizzle の Codecs のドキュメントによる）。

## 理由

### 1. 公式ドキュメントが、forJsonSelect と fromJson を非推奨としている

- Drizzle の Custom types のドキュメント（https://orm.drizzle.team/docs/custom-types ）は、`forJsonSelect`、`fromJson`、`jsonData` を非推奨と記載し、代わりに codec を使うよう求めている。
- 一方、SQLite 版の「Relational Queries v1 to v2」のドキュメント（https://orm.drizzle.team/docs/sqlite/relations-v1-v2 ）には、`forJsonSelect` と `fromJson` を使う例が載っている。2 つのドキュメントの記載は食い違っているが、非推奨と明記しているほうに従う。

### 2. codec "blob" を指定すると、2 つの読み出し方の両方で Drizzle 組み込みの変換が使われる

drizzle-orm のソース（`sqlite-core/codecs.js` と `libsql/codecs.js`）で、codec `"blob"` が次の変換をすることを確かめた。

- 通常の読み出しでは、ドライバーが返した値を Buffer に変換する。Buffer が無い実行環境では Uint8Array に変換する。
- 入れ子の読み出しでは、SQL の中で `hex()` を使って BLOB を 16 進の文字列に変換し、受け取った文字列をバイト列に戻す。

どちらの読み出し方でも `fromDriver` にはバイト列が渡されるので、`fromDriver` はバイト列を数値の配列に戻す処理だけを持てばよい。変更前の `fromDriver` は、ドライバーが ArrayBuffer を返す場合と Uint8Array を返す場合の両方を自分で扱っていた。

## 検討した他の案

- **`forJsonSelect` で `vector_extract()` を使ってベクトルを文字列にし、`fromJson` で `JSON.parse` する**：最初に試した方法である。非推奨の機能を使ううえ、`vector_extract()` に NULL を渡すとエラーになるので、NULL を避ける `case` 式が別に必要になる。採用しない。
- **`forJsonSelect` で `hex()` を使い、`fromJson` でバイト列に戻す（Relational Queries v1 to v2 のドキュメントの例）**：codec `"blob"` と同じ変換を自分で書くことになり、しかも非推奨の機能を使う。採用しない。
- **ベクトルの列をリレーショナルクエリで読み出さないことにする**：読み出す処理ごとに列を除外する必要があり、除外が守られているかどうかを型検査で確かめる方法がない。採用しない。

## この決定による影響

- この型の列は NOT NULL で使う。codec `"blob"` が使う `hex()` は、値が NULL のとき NULL ではなく空の文字列を返す。そのため NULL を許す列では、入れ子の読み出しで NULL が空の配列になる。現在この型を使う列は `post_embeddings.embedding` だけであり、NOT NULL である（ADR 0001 を参照）。なお、埋め込みの行が無い投稿をリレーションで読み出した場合の `null` は、行が無いことを示す値なので、この問題の対象ではない。
- Cloudflare Workers の上で、Uint8Array に変換される経路はまだ確かめていない。ローカルの turso dev と、メモリ上の libSQL では確かめた。
