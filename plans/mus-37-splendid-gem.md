# MUS-37: 曲登録の TOCTOU レースで不要な 500 を「fetch してリトライ」で解消する

Linear: [MUS-37](https://linear.app/music-social/issue/MUS-37)

## Context

`registerPost`（`apps/api/src/features/posts/usecase.ts:97-157`）と `registerFavoriteSong`（`apps/api/src/features/favorite-songs/usecase.ts:91-170`）は次の TOCTOU 構造を持つ:

1. トランザクション外で曲の存在チェック（`deletedAt IS NULL` 条件）
2. 存在しなければ `fetchSong`（Apple Music API）で `songInput` / `songData` を用意。**存在すれば null のまま**
3. `withRls` トランザクション内で `findSongByAppleMusicId`（同じく `deletedAt IS NULL`）で再検索
4. 見つからず songInput も null → `Failed to resolve song information.` / `楽曲情報の取得に失敗しました。` の **500**

1〜3 の間に並行 soft-delete が挟まると 4 に落ちる。insert 側（`createSongFull` / `createSongFromAppleMusic`、`apps/api/src/features/songs/repository.ts`）は既に `onConflictDoUpdate(target: appleMusicId, set: { ..., deletedAt: null })` の冪等 upsert（soft-delete 行を復活させる）なので、**曲情報さえ手元にあれば必ず解決できる**。欠けているのはデータだけ。

**決定済み方針（ユーザー承認済み）**: レース検知時はトランザクションを一旦抜け、外で `fetchSong` → `withRls` を **1 回だけ**再実行する。トランザクション内で外部 API は呼ばない（Supavisor transaction pooling で接続を長時間占有しないため）。2 回目も失敗した場合は現行どおりのエラーで終端。

## 設計の要点

### レース検知の伝達: module-private な Symbol sentinel

```ts
// レース検知用 sentinel: tx 内で楽曲が見つからず、事前 fetch もしていない場合に返す
const songMissingInTx = Symbol("song-missing-in-tx");
```

- レース検知は失敗ではなく制御フロー信号なので、Error にせず値として返す（errore 規約と両立。`withRls<T>` はジェネリックなのでそのまま union に伝播し、`rls.ts` の変更は不要）
- **sentinel チェックは外側の `result instanceof Error` 判定より前に置く**（逆順だと Symbol が Error 処理をすり抜ける）

### 共通ヘルパーには抽出しない

posts と favorite-songs で準備データの形・tx 本体・エラーメッセージがすべて異なり、共通化はコールバック 2 つを受ける過剰な抽象化になる。重複は sentinel 定義 1 行 + リトライ駆動部 ~8 行のみ。各 usecase 内で素直に書く（rule of three）。ただし各 usecase 内では「fetch → 入力組み立て」をローカル関数（`prepareSongInput` / `prepareSongData`）に抽出し、初回とリトライで共用する。

### TypeScript narrowing の注意

リトライ実装では closure（tx コールバック）生成後に `songInput` を再代入するため、現行コードが依存している narrowing が無効化される。宣言型から Error を除外する:

- posts: `let songInput: Exclude<ReturnType<typeof toSongInput>, Error> | null = null;`
- favorite-songs: IIFE（105-116 行）を廃止し、明示型 `let songData: { title: string; durationInMillis?: number; isrc?: string } | null = null` + if 文に書き換え

## 変更内容

### 1. `apps/api/src/features/posts/usecase.ts` — `registerPost`

```ts
const songMissingInTx = Symbol("song-missing-in-tx");

export const registerPost = async (payload, session, db) => {
  // 既存: トランザクション外の存在チェック（103-106 行そのまま）

  // Apple Music から取得して songInput を組み立てる（初回・リトライで共用）
  const prepareSongInput = async () => {
    const apiResponse = await fetchSong(payload.appleMusicId);
    if (apiResponse instanceof Error) return apiResponse;
    return toSongInput(apiResponse);
  };

  let songInput: Exclude<ReturnType<typeof toSongInput>, Error> | null = null;
  if (!songExists) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
  }

  // tx 本体をローカル関数化（リトライで再利用）。中身は現行 117-144 行とほぼ同一。
  // 変更点は 124-126 行のみ:
  //   if (!songInput) return songMissingInTx;  // 存在チェック後に soft-delete されたレース
  const runTransaction = () => withRls(db, session, async (tx, userId) => { ... });

  let result = await runTransaction();

  // レース検知時: トランザクション外で fetch → 1 回だけ再実行
  // createSongFull は onConflictDoUpdate(deletedAt: null) の冪等 upsert なので再実行時は解決する
  if (result === songMissingInTx) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
    result = await runTransaction();
  }
  if (result === songMissingInTx) {
    // songInput を用意して再実行したため到達しない想定（型 narrowing のための防御的ガード）
    return new DbError({ message: "Failed to resolve song information." });
  }

  // 既存のエラー処理・結果処理（146-156 行そのまま）
};
```

### 2. `apps/api/src/features/favorite-songs/usecase.ts` — `registerFavoriteSong`

同じパターン。差分:

- インライン存在チェック（97-103 行）はそのまま
- IIFE を `prepareSongData` ローカル関数 + 明示型 `let songData` + if 文に置換
- tx 内 133-137 行の `if (!songData) return new DbError(...)` を `return songMissingInTx` に置換
- tx を `runTransaction` にローカル関数化し、sentinel 検知で `prepareSongData` → 再実行（1 回）
- 防御的ガードは `楽曲情報の取得に失敗しました。` の DbError
- 既存のエラー処理（160-169 行）はそのまま

### 3. 変更不要

- `songs/repository.ts`（upsert は既に冪等）、`shared/db/rls.ts`、`shared/apple-music/*`、ルート・スキーマ

## TDD テストリスト（t-wada 方式: Red → Green → リファクタを 1 件ずつ）

posts → favorite-songs の順に実施。

### posts (`apps/api/src/__tests__/features/posts/usecase.test.ts`)

1. **[新規] レース検知 → リトライ成功**: `songExistsByAppleMusicId → true`、`findSongByAppleMusicId → null`（2 回とも）、`fetchSong`/`toSongInput`/`findOrCreateArtists`/`createSongFull`/`createPost` 正常モック。検証: `{ post }` が返る、`withRls` **2 回**、`fetchSong` **1 回**、`createSongFull` が fetch した songInput で呼ばれる。既存の `withRls` モック（`mockImplementation(async (_db,_s,fn) => fn(tx,"user-id"))`）のままで OK
2. **[新規] レース検知 → fetchSong 失敗（404）はそのまま返る**: `fetchSong → DbError(404)`。検証: その DbError が `toBe` で返る、`withRls` は 1 回のみ
3. **[新規] レース検知 → toSongInput 失敗はそのまま返る**（posts のみ）
4. **[新規] レース検知 → リトライの tx も失敗したら 500 "Failed to create post."**: `withRls` を `mockImplementationOnce(実行) → mockResolvedValueOnce(RlsError)` の 2 連チェーンで 1 回目/2 回目を制御
5. **[修正必須] 既存テスト "preserves non-500 DbError from inside the transaction"**: 現状 `songExists=true` + `findSong=null` のセットアップで、実は `songInput=null` の 500 分岐（今回レース分岐に変わる経路）に落ちている。`songExists → false` + `fetchSong`/`toSongInput` 正常モックに書き換えて本来意図した `findOrCreateArtists` エラー経路を通す
6. **[回帰] 既存ハッピーパス**: 変更なしで通ることを確認。非レース時に `withRls` が 1 回のみであることを追加 assert（任意）

### favorite-songs (`apps/api/src/__tests__/features/favorite-songs/usecase.test.ts`)

7. **[新規] レース検知 → リトライ成功**: `createExistingSongQuery([{ id }])`（tx 外では存在）+ `findSongByAppleMusicId → null` + `fetchSong`/`createSongFromAppleMusic`/`addFavoriteSong` 正常モック。検証: `{ favorite }`、`withRls` 2 回、`fetchSong` 1 回、`createSongFromAppleMusic` の引数（title/duration/isrc）
8. **[新規] レース検知 → fetchSong 失敗（404）はそのまま返る**（`withRls` 1 回のみ）
9. **[新規] レース検知 → リトライ tx 失敗 → 500 "お気に入り楽曲の登録に失敗しました。"**（テスト 4 と同じチェーン手法）
10. **[回帰] 既存 5 件**: 挙動不変で通ることを確認

備考: 防御的ガード（2 回目も sentinel）は sentinel が module-private のため外から再現不能な到達不能コード。テスト対象外。

## 検証

```bash
bun run test --filter=api      # 各 Green 後・リファクタ後（unit、DB 不要）
bun run check-types            # narrowing 変更が正しいことの確認
bun run lint
```

実 DB でのレース再現は統合テストでは困難（並行 soft-delete のタイミング制御が必要）なため、unit テストでの検証を主とする。既存の `repository.db.test.ts` は変更対象外なので影響なし。

## リスク・注意点

- **withRls 再実行コスト**: `resolveFirebaseId` + 新規 tx + `set_config` が再実行されるが、レース時のみ・最大 1 回。非レース経路のコストは増えない
- **リトライ fetch の 404/502**: DB にあった曲がカタログから消えている場合は 404 がそのまま返る。現行の 500 より適切
- **sentinel チェックの位置**: `instanceof Error` 判定より前に置くこと
- **無限リトライなし**: ループではなく明示的な 1 回リトライの直列コード
