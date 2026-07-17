# MUS-36: 楽曲作成パスを createSongFull に統一

## Context

楽曲の find-or-create が 2 系統に分かれており、結果が食い違う（Linear MUS-36, Bug/High）:

- **posts / songs 経由**: `createSongFull` — `songArtists` / `songGenres` の紐付けあり。conflict 時に title / length / isrcs を更新し soft-delete を解除
- **favorite-songs 経由**: `createSongFromAppleMusic`（`apps/api/src/features/songs/repository.ts:202`）— 紐付けなし。conflict 時は title のみ更新

お気に入り登録が最初の接触だった曲は、アーティスト・ジャンル情報を持たない不完全なレコードになる。`registerFavoriteSong` はすでに `fetchSong`（`?include=artists` 付き）を呼んでおり、アーティスト・ジャンルのデータはレスポンスに含まれているのに捨てている。必要な部品（`toSongInput` / `findOrCreateArtists` / `createSongFull`）はすべて既存で、`registerPost` が同一の統一パターンを実装済み。

**方針**: `registerFavoriteSong` を `registerPost` と同じ `toSongInput` + `findOrCreateArtists` + `createSongFull` パターンに統一し、`createSongFromAppleMusic` を削除する。

## 変更ファイル

### 1. `apps/api/src/features/favorite-songs/usecase.ts` — `registerFavoriteSong`（94-174行）

`registerPost`（`apps/api/src/features/posts/usecase.ts:106-145`）のパターンをミラーする:

**トランザクション外（現 99-121 行）:**

- 既存曲チェックの inline select（101-107行）を既存ヘルパー `songExistsByAppleMusicId(db, input.appleMusicId)`（`songs/repository.ts:182`）に置き換え（`.catch((e) => toDbError(e, "楽曲の検索に失敗しました。"))` 付き）
- `songData`（title/durationInMillis/isrc の手組み）を廃止し、`toSongInput(await fetchSong(input.appleMusicId))` に置き換え。`fetchSong` エラー・`toSongInput` エラーをそれぞれ早期 return（registerPost 112-118 行と同形）

**トランザクション内（現 124-162 行）:**

- `findSongByAppleMusicId` で見つかった場合の分岐は現状維持
- 未登録の場合:
  - `songInput` が null なら現行どおり `DbError("楽曲情報の取得に失敗しました。")`
  - `findOrCreateArtists(tx, songInput.artistEntries)`（`artists/repository.ts:108`）を `.catch(toDbError)` 付きで呼ぶ（registerPost 131-134 行と同形）
  - `createSongFromAppleMusic(...)` → `createSongFull(tx, { songValues: songInput.songValues, artistIds, genreNames: songInput.genreNames })` に置き換え。戻り値は配列でなく `song | null` なので、`!song` なら `DbError("楽曲の作成に失敗しました。")`、成功なら `song.id` で `addFavoriteSong`

**import 変更:**

- 削除: `createSongFromAppleMusic`、`songs`（schema）、`and, eq, isNull`（drizzle-orm）※inline select 廃止で不要になる
- 追加: `songExistsByAppleMusicId, createSongFull`（`../songs/repository`）、`toSongInput`（`../../shared/apple-music`）、`findOrCreateArtists`（`../artists/repository`）

### 2. `apps/api/src/features/songs/repository.ts` — `createSongFromAppleMusic` 削除（201-225行）

唯一の呼び出し元が favorite-songs なので、統一後に関数ごと削除。knip（`bun run check-dead-code`）で残骸がないことを確認。

### 3. `apps/api/src/__tests__/features/favorite-songs/usecase.test.ts` — テスト更新

t-wada TDD（CLAUDE.md）に従い、**テスト先行（Red 確認）→ 実装（Green）** の順で進める。

**テストリスト（registerFavoriteSong の新しい振る舞い）:**

1. 未登録曲の登録時、`toSongInput` の結果を使って `findOrCreateArtists(tx, artistEntries)` と `createSongFull(tx, { songValues, artistIds, genreNames })` が呼ばれ、作成された曲 ID で `addFavoriteSong` される
2. `toSongInput` がエラーを返した場合、`withRls` を開かずにそのエラーを返す
3. `findOrCreateArtists` が失敗した場合、DbError にラップされて返る
4. 既存テストの維持: 既存曲は Apple Music を呼ばない / fetchSong エラーは tx 前に返る / 非 500 エラー保持 / RLS 失敗ラップ

**モック変更**（posts/usecase.test.ts:9-38 のパターンに合わせる）:

- `mocks.createSongFromAppleMusic` → `mocks.createSongFull` に差し替え（`songs/repository` の mock は `findSongByAppleMusicId, createSongFull, songExistsByAppleMusicId` を export）
- `mocks.findOrCreateArtists`（`../../../features/artists/repository` の mock）と `mocks.toSongInput`（`../../../shared/apple-music` の mock に追加）を追加
- 既存の 161-201 行のテスト「fetches and creates the song…」は `createSongFull` の呼び出し形状（artistIds / genreNames 含む）のアサーションに書き換え
- `createExistingSongQuery` ヘルパーは `songExistsByAppleMusicId` の mock に置き換わるため削除可能

## 実装手順（TDD）

1. テストリスト 1 のテストを書き換え、失敗（Red）を確認
2. `registerFavoriteSong` を `createSongFull` パターンに書き換えて Green
3. テストリスト 2, 3 を 1 つずつ Red → Green
4. `createSongFromAppleMusic` を repository から削除（この時点で参照ゼロ）
5. リファクタリング: import 整理、`createExistingSongQuery` ヘルパー削除

## 検証

```bash
# ユニットテスト（対象ファイル → 全体）
bun run test --filter=api -- src/__tests__/features/favorite-songs/usecase.test.ts
bun run test --filter=api

# DB 統合テスト（createSongFull の revive 挙動は repository.db.test.ts で既にカバー済み）
just db-start && bun run test:db --filter=api

# 品質チェック（lint / 型 / dead code — createSongFromAppleMusic 削除の確認を含む）
bun run quality
```

**挙動確認の観点**: お気に入り登録（`POST /api/me/favorites/songs`）で新規作成された曲が `song_artists` / `song_genres` に紐付き、soft-delete 済み曲の再登録時に length / isrcs も更新されること（`createSongFull` の既存挙動に乗る）。
