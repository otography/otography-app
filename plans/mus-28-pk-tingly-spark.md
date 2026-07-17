# MUS-28: 既存曲の再登録が song_artists PK 違反で 500 になる修正

## Context

`POST /api/songs` で同じ `appleMusicId` を 2 回送ると 500 になる。

原因: `apps/api/src/features/songs/repository.ts` の `createSongFull` は songs を
`onConflictDoUpdate` で upsert した後、`addSongArtists` / `addSongGenres` で
リンクテーブルへ**無条件 INSERT** する。再登録時は既存の紐付けと
song_artists / song_genres の複合 PK（`(song_id, artist_id)` / `(song_id, genre_id)`）が
衝突し、`normalizeSongDbError`（usecase.ts）は `songs_apple_music_id_key` 制約しか
拾わないため 500 に落ちる。

**方針（ユーザー確認済み）: 紐付けの全置換。** `registerSong` は毎回 Apple Music から
最新データを取得するので、紐付けも最新に同期するのが正しい。`updateSongFull`
（syncSong）と同じセマンティクスになる。RLS 上も song_artists / song_genres は
authenticated に delete が許可されており問題ない。

## 変更内容

### 1. テスト追加（Red を先に確認 — t-wada TDD）

`apps/api/src/__tests__/features/songs/repository.db.test.ts` に追加
（既存の `createSongFull` テストと同じスタイル、fixtures の `createArtist` /
`createGenre` を利用）:

**テストリスト:**

1. 同じ `appleMusicId` で `createSongFull` を 2 回呼んでも PK 違反にならず song が返る
   （アーティスト・ジャンル付きで 2 回呼ぶ。現状は throw → Red）
2. 再登録時に紐付けが最新データへ全置換される
   （1 回目: アーティスト A + ジャンル "Pop"、2 回目: アーティスト B + ジャンル "Rock"
   → song_artists / song_genres には B / "Rock" のみ残る）

テストは 1 つずつ書いて Red → Green を回す。

### 2. 実装（`apps/api/src/features/songs/repository.ts`）

- `createSongFull`（139-140 行目）の呼び出しを差し替え:
  - `addSongArtists` → 既存の `replaceSongArtists`（98 行目）
  - `addSongGenres` → 既存の `replaceSongGenres`（65 行目）
- 未使用になる `addSongArtists`（85-95 行目）と `addSongGenres`（50-62 行目）を削除
  （knip の dead-code チェック対策。`findOrCreateGenreIds` は `replaceSongGenres` が
  使うので残す）

usecase.ts / route.ts の変更は不要（衝突自体が発生しなくなるため
`normalizeSongDbError` はそのままで良い）。

## 検証

1. `just db-start` で PostgreSQL 起動
2. `bun run test:db --filter=api` — 新テスト含め全 DB テストが通ること
3. `bun run test --filter=api` — 既存 unit テストに回帰がないこと
4. `bun run quality`（check-types / lint / check-dead-code）が通ること
5. E2E 再現確認: dev サーバーで `POST /api/songs { appleMusicId: X }` を 2 回叩き、
   2 回目も 500 にならず成功すること（可能なら）
