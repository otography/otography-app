# Fix: createSongFull で soft-delete 済み song の appleMusicId conflict を処理

## Context

post 作成フロー (`registerPost`) で、soft-delete 済み song と同じ `appleMusicId` を持つ投稿を作成すると unique constraint violation → 500 エラーになる。`createSongFull` が plain INSERT で conflict 対応していないため。`createSongFromAppleMusic` や `findOrCreateArtists` は既に `onConflictDoUpdate({ deletedAt: null })` で対応済み。

## TDD アプローチ (Red → Green → Refactor)

### Step 1: Red — 失敗するテストを書く

`songs/repository.db.test.ts` に `createSongFull` の soft-delete 復活テストを追加。`artists/repository.db.test.ts:60-83` の `"soft-delete 済み artist と同じ appleMusicId で呼ぶと復活させる"` と同じパターン。

```ts
// songs/repository.db.test.ts に追加
it("soft-delete 済み song と同じ appleMusicId で createSongFull を呼ぶと復活させる", async () => {
  // Given: song を作成 → soft-delete
  const { id: deletedSongId } = await createSong(db, { appleMusicId: "am-deleted-song" });
  await db
    .update(songs)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(songs.id, deletedSongId));

  // When: 同じ appleMusicId で createSongFull を呼ぶ
  const result = await createSongFull(db, {
    songValues: {
      title: "Revived Song",
      appleMusicId: "am-deleted-song",
      length: null,
      isrcs: null,
    },
    artistIds: [],
    genreNames: [],
  });

  // Then: 復活した song が返る（constraint error ではなく）
  expect(result).not.toBeNull();
  expect(result!.id).toBe(deletedSongId);

  // deletedAt が null に戻っている
  const [row] = await db
    .select({ deletedAt: songs.deletedAt })
    .from(songs)
    .where(eq(songs.id, deletedSongId));
  expect(row.deletedAt).toBeNull();
});
```

既存テストとの整合性: `createSongFull` は `DatabaseOrTransaction` を受け取るので `db` を直接渡せる。ただし実際のシグネチャは `DatabaseTransaction` なので、必要に応じて `withAnonymousRole` 等でラップする（`artists/repository.db.test.ts` と同じアプローチ）。

テスト実行 → **失敗することを確認** (unique constraint violation でエラー)。

### Step 2: Green — 最小限の修正でテストを通す

**`apps/api/src/features/songs/repository.ts` line 123** — `createSongFull` に `onConflictDoUpdate` を追加:

```ts
// Before:
const rows = await tx.insert(songs).values(songValues).returning(songColumns);

// After:
const rows = await tx
  .insert(songs)
  .values(songValues)
  .onConflictDoUpdate({
    target: songs.appleMusicId,
    set: {
      title: songValues.title,
      length: songValues.length,
      isrcs: songValues.isrcs,
      deletedAt: null,
    },
  })
  .returning(songColumns);
```

`onConflictDoUpdate` により、soft-delete 済み row と衝突した場合は `deletedAt: null` で復活 + フィールド更新。その後の `addSongArtists` / `addSongGenres` も引き続き実行される。

テスト実行 → **通ることを確認**。

### Step 3: Refactor

必要があればテスト・本番コードを整理。`createSongFromAppleMusic` と `createSongFull` の `onConflictDoUpdate` の `set` 内容を比較し、方針が整合していることを確認。

## 影響範囲

呼び出し元 2 箇所が同じ修正の恩恵を受ける（コード変更なし）:

- `posts/usecase.ts:registerPost` (line 125) — 今回のバグ発生箇所
- `songs/usecase.ts:registerSong` (line 87) — 同じ問題が起こり得た箇所

## 確認方法

1. `bun run test:db --filter=api` — 追加したテストが Red → Green になることを確認
2. `bun run test --filter=api` — 既存テストが全て通ることを確認
3. `bun run check-types --filter=api` — 型エラーなし
