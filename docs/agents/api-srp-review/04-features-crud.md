# 04 — features/artists, songs, favorites\* SRPレビュー

**対象ファイル**:

- `features/artists/` (5ファイル)
- `features/songs/` (5ファイル)
- `features/favorite-artists/` (5ファイル)
- `features/favorite-songs/` (5ファイル)
- `features/favorites/` (2ファイル: model.ts, usecase.ts)

## 結果サマリー

| ファイル                       | SRP | 合成性 |
| ------------------------------ | --- | ------ |
| artists/index.ts               | ✅  | ✅     |
| artists/model.ts               | ✅  | ✅     |
| artists/repository.ts          | ⚠️  | ✅     |
| artists/route.ts               | ✅  | ✅     |
| artists/usecase.ts             | ✅  | ✅     |
| songs/index.ts                 | ✅  | ✅     |
| songs/model.ts                 | ✅  | ✅     |
| songs/repository.ts            | ⚠️  | ✅     |
| songs/route.ts                 | ✅  | ✅     |
| songs/usecase.ts               | ✅  | ✅     |
| favorite-artists/index.ts      | ✅  | ✅     |
| favorite-artists/model.ts      | ✅  | ✅     |
| favorite-artists/repository.ts | ⚠️  | ✅     |
| favorite-artists/route.ts      | ✅  | ✅     |
| favorite-artists/usecase.ts    | ⚠️  | ✅     |
| favorite-songs/index.ts        | ✅  | ✅     |
| favorite-songs/model.ts        | ✅  | ✅     |
| favorite-songs/repository.ts   | ⚠️  | ✅     |
| favorite-songs/route.ts        | ✅  | ✅     |
| favorite-songs/usecase.ts      | ⚠️  | ✅     |
| favorites/model.ts             | ✅  | ✅     |
| favorites/usecase.ts           | ✅  | ✅     |

**総評**: feature-based architecture が一販して適用されている。route層にビジネスロジックが漏出しておらず、usecase層が適切にオーケストレーションを担当。`favorites/usecase.ts` の `getFavoritePage` / `deleteFavorite` の汎用化は秀逸。

## 詳細（問題のあるファイルのみ）

### `artists/repository.ts` ⚠️

**問題点**:

- `findOrCreateArtists`（行90-120）は **songs 用のfind-or-createヘルパー** が混在。`songs/usecase.ts` の `resolveArtistIds` から呼ばれるcross-featureな責務。
- `createArtistFromAppleMusic`（行76-89）もApple Music由由来の特殊なupsert（`onConflictDoUpdate` で `deletedAt: null` を復元）。`favorite-artists/usecase.ts` からも呼ばれる。

**推奨**: `artists/repository.ts` を純粋なCRUDに保ち、cross-featureなヘルパーを `artists/apple-music-sync.ts` 等の別モジュールに分離。

---

### `songs/repository.ts` ⚠️

**問題点**:

- `songs/repository.ts` が4テーブル操作を担当: `songs`, `song_artists`, `song_genres`, `genres`
- `findOrCreateGenreIds`（行24-38）は `genres` テーブルへの操作。将来 genre feature が分離された時に移動が必要。

**推奨**: 現状（genre = songの従属テーブル）という設計判断が明確であれば許容。ただし4テーブルが混在していることは認識しておくべき。

---

### `favorite-artists/repository.ts` と `favorite-songs/repository.ts` ⚠️（一貫性の問題）

**共通する問題点**:

1. **エラー正規化の層違反**: repository 層にあるべきでないドメインロジックが混入:
   - `favorite-artists/repository.ts`: `toAddFavoriteArtistError`（行23-27）
   - `favorite-songs/repository.ts`: `toAddFavoriteSongError`（行30-34）、`createDuplicateFavoriteSongError`（行22-27）
   - 対照的に `artists/repository.ts` や `songs/repository.ts` はエラー正規化を持たず、usecase 側で処理。パターンが一貫していない。

2. **list系の完全重複**:
   - `listFavoriteArtists`（行29-52）と `listFavoriteArtistsPublic`（行82-104）がクエリ完全同一
   - `listFavoriteSongs`（行37-60）と `listFavoriteSongsPublic`（行93-115）も同様

3. **重複検知戦略の不一致**:
   - `favorite-artists`: `.catch(toAddFavoriteArtistError)` で `favorite_artists_pkey` 制約違反を捕捉
   - `favorite-songs`: `.onConflictDoNothing` + `result.length === 0` で重複検知しドメインエラーを生成
   - 同一ドメイン（重複検知）で2つの異なる実装戦略

**推奨**:

1. エラー正規化関数をusecase層に移動
2. `listFavoriteArtists`/`listFavoriteArtistsPublic`（およびsongs版）を `DatabaseOrTransaction` を受け取る単一関数に統合
3. 重複検知戦略を統一

---

### `favorite-artists/usecase.ts` ⚠️

**問題点**:

1. **raw Drizzleクエリの漏出**（行50-55）:

   ```ts
   db.select({ id: artists.id }).from(artists).where(...)
   ```

   `favorite-artists/usecase.ts` に生のDrizzleクエリが書かれている。data access層の責務。`artists/repository.ts` の `findArtistByAppleMusicId` を使うべき。

   ※ `favorite-songs/usecase.ts` 行74 は既に `songExistsByAppleMusicId` を使っており、対称にすべき。

2. **`registerFavoriteArtist`（行48-96）のロジック肥大化**: 事前チェック → Apple Music fetch → tx内find-or-create の複数ステップが1関数に。

**推奨**:

1. 行50-55 のrawクエリを `artistExistsByAppleMusicId` のようなrepository関数に置換（`songs/repository.ts` の `songExistsByAppleMusicId` と対称に）
2. または既存の `findArtistByAppleMusicId` を使用（引数型を `DatabaseOrTransaction` に widening）

---

### `favorite-songs/usecase.ts` ⚠️

**問題点**:

1. **`registerFavoriteSong`（行62-154）の複雑さ**: 以下の5つの責務が混在:
   - 曲存在チェック（行74-78）
   - Apple Music fetch + songInput組み立て（行80-89）
   - トランザクション実行（find-or-create favorite、create song含む）（行92-123）
   - **レースコンディションのリトライ制御**（行137-146）: `songMissingInTx` sentinel + 1回限りの再実行
   - エラー分類（行148-153）

2. **リトライロジックのインライン化**: `runTransaction()` と `songMissingInTx` sentinel（行63, 行111）を使った制御フローが独立ヘルパーに抽出可能。

3. **`favorite-artists/usecase.ts` との非対称**: `registerFavoriteArtist` は同じ「事前チェック→fetch→tx内でfind-or-create」パターンだが、リトライ機構を持たない。

**推奨**:

1. リトライロジックを `withRaceRetry` のような明示的ヘルパーに抽出
2. `favorites/usecase.ts` に `registerFavorite` 汎用版を新設できないか検討（既存の `getFavoritePage`/`deleteFavorite` パターンを踏襲）

---

### `favorites/usecase.ts` ✅（高評価）

**責務**: リソース種別に依存しない、お気に入り一覧取得（`getFavoritePage`）と削除（`deleteFavorite`）の汎用ユースケース。

generic型パラメータ `<T extends { favorite: FavoriteMetadata }, U extends object>` でartist/song双方に対応。`normalizeLimit`, `createPage`, `withRls`, `toDbError` へ適切にdelegate。呼び出し側は `load`, `findResource`, `remove`, `getFavoriteId`, `mapResource` を注入するだけ。

この設計は高く評価できる。`registerFavoriteArtist`/`registerFavoriteSong` も同レベルの一般化の余地がある。

---

## Top 3 アクションアイテム

1. **`favorite-artists/usecase.ts` 行50-55**: raw Drizzleクエリを `artistExistsByAppleMusicId` に置換（`favorite-songs` 側と対称化）
2. **favorite系repositoryのエラー正規化をusecase層へ移動**、重複検知戦略の統一、list系の重複統合
3. **`favorite-songs/usecase.ts` `registerFavoriteSong`**: リトライロジックをヘルパー抽出、`favorites/usecase.ts` への一般化を検討
