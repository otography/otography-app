# Fix: findOrCreateArtists が soft-delete 済み artist の id を返すバグ

## Context

`findOrCreateArtists`（バッチ find-or-create）は `onConflictDoNothing` を使っているため、
同一 `appleMusicId` で soft-delete 済み（`deletedAt` 非 NULL）の行が存在すると:

1. INSERT が何もしない（行は既に存在するため）
2. 直後の SELECT が削除済み行の ID を返す
3. その ID が `song_artists` に挿入され、RLS で非表示になる → artist 関連が欠落

一方 `createArtistFromAppleMusic`（単体版、同ファイル 89-105 行目）は
`onConflictDoUpdate` で `deletedAt: null` を設定し正しく復活させている。
バッチ側も同じ挙動にする。

**TDS（Test-Driven Solutions）**: まず失敗するテストを書き、テストが通るように修正する。

---

## Step 1: 失敗するテストを追加

**ファイル**: `apps/api/src/__tests__/features/artists/repository.db.test.ts`

既存テストの後に以下を追加:

```typescript
it("soft-delete 済み artist と同じ appleMusicId で呼ぶと復活させる", async () => {
  // Given: artist 作成 → soft-delete
  const deleted = await createArtist(db, { appleMusicId: "am-deleted" });
  await db
    .update(artists)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(artists.id, deleted.id));

  // When: 同じ appleMusicId で findOrCreateArtists
  const ids = await findOrCreateArtists(db, [
    { appleMusicId: "am-deleted", name: "Resurrected Artist" },
  ]);

  // Then: 復活した artist の ID が返る
  expect(ids).toHaveLength(1);
  expect(ids).toContain(deleted.id);

  // deletedAt がクリアされている
  const [row] = await db
    .select({ deletedAt: artists.deletedAt })
    .from(artists)
    .where(eq(artists.id, deleted.id));
  expect(row.deletedAt).toBeNull();
});
```

`import { eq } from "drizzle-orm"` をファイル先頭に追加する必要がある。

**このテストは現在の実装では失敗する**: `onConflictDoNothing` → SELECT が `deletedAt` 非 NULL の行を返すが、
`deletedAt` はクリアされない。RLS が有効な環境では `deletedAt` 非 NULL の artist に紐付く
`song_artists` 行が見えなくなる。

## Step 2: テストが通るように修正

**ファイル**: `apps/api/src/features/artists/repository.ts`（117 行目付近）

```diff
 await db
   .insert(artists)
   .values(newArtists.map((a) => ({ name: a.name, appleMusicId: a.appleMusicId })))
-  .onConflictDoNothing({ target: artists.appleMusicId });
+  .onConflictDoUpdate({
+    target: artists.appleMusicId,
+    set: {
+      name: sql`EXCLUDED.name`,
+      deletedAt: null,
+    },
+  });
```

`sql` はファイル内で既に import 済み。

## 既存の同等パターン（参考）

- `createArtistFromAppleMusic`（同ファイル 89-105 行目）: `onConflictDoUpdate` + `deletedAt: null`
- `createSongFromAppleMusic`（`songs/repository.ts` 197-213 行目）: 同パターン

## 検証

1. `bun run test --filter=api -- src/__tests__/features/artists/repository.db.test.ts` — テストが通ることを確認
2. `bun run test --filter=api` — 既存テストの回帰がないことを確認
3. `bun run check-types` — 型エラーがないことを確認
