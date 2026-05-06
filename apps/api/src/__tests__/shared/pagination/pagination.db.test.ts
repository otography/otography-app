import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listPostsWithLikes } from "../../../features/posts/repository";
import {
  buildPaginationMeta,
  normalizeLimit,
  trimItems,
  type Cursor,
} from "../../../shared/pagination";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createSong, createUser } from "../../helpers/db/fixtures";
import { withAnonymousRole } from "../../../shared/db/rls";
import { posts } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

// createdAt を1秒ずつずらして INSERT するヘルパー
const insertPostsWithStaggeredCreatedAt = async (
  count: number,
  baseTime = "2026-03-01T00:00:00.000Z",
) => {
  const author = await createUser(db);
  const song = await createSong(db);
  const base = new Date(baseTime).getTime();
  for (let i = 0; i < count; i++) {
    await db.insert(posts).values({
      userId: author.id,
      songId: song.id,
      content: `post-${i}`,
      createdAt: new Date(base + i * 1000).toISOString(),
    });
  }
  return { author, song };
};

describe("pagination (real DB)", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("データ件数 < limit のとき hasNext=false, nextCursor=null になる", async () => {
    // Given: 投稿を3件作成
    await insertPostsWithStaggeredCreatedAt(3);

    const limit = normalizeLimit(5);

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit }));
    if (rows instanceof Error) throw rows;

    const meta = buildPaginationMeta(rows, limit);
    const items = trimItems(rows, limit);

    // Then
    expect(items).toHaveLength(3);
    expect(meta).toEqual({ hasNext: false, nextCursor: null });
  });

  it("データ件数 = limit のとき hasNext=false, nextCursor=null になる", async () => {
    // Given: 投稿を5件作成
    await insertPostsWithStaggeredCreatedAt(5);

    const limit = normalizeLimit(5);

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit }));
    if (rows instanceof Error) throw rows;

    const meta = buildPaginationMeta(rows, limit);
    const items = trimItems(rows, limit);

    // Then
    expect(items).toHaveLength(5);
    expect(meta).toEqual({ hasNext: false, nextCursor: null });
  });

  it("データ件数 > limit のとき hasNext=true, nextCursor が最後のアイテムを指す", async () => {
    // Given: 投稿を7件作成
    await insertPostsWithStaggeredCreatedAt(7);

    const limit = normalizeLimit(5);

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit }));
    if (rows instanceof Error) throw rows;

    const meta = buildPaginationMeta(rows, limit);
    const items = trimItems(rows, limit);

    // Then
    expect(items).toHaveLength(5);
    expect(meta.hasNext).toBe(true);
    expect(meta.nextCursor).not.toBeNull();

    // nextCursor は items の最後の要素を指す
    const lastItem = items[items.length - 1]!;
    expect(meta.nextCursor!.id).toBe(lastItem.id);
  });

  it("nextCursor で次ページを取得し、重複・欠落がない", async () => {
    // Given: 投稿を7件作成
    await insertPostsWithStaggeredCreatedAt(7);

    const limit = normalizeLimit(5);

    // When: 1ページ目
    const page1Rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit }));
    if (page1Rows instanceof Error) throw page1Rows;

    const page1Meta = buildPaginationMeta(page1Rows, limit);
    const page1Items = trimItems(page1Rows, limit);

    expect(page1Meta.hasNext).toBe(true);
    const cursor = page1Meta.nextCursor!;

    // When: 2ページ目
    const page2Rows = await withAnonymousRole(db, (tx) =>
      listPostsWithLikes(tx, null, { limit, cursor }),
    );
    if (page2Rows instanceof Error) throw page2Rows;

    const page2Meta = buildPaginationMeta(page2Rows, limit);
    const page2Items = trimItems(page2Rows, limit);

    // Then: 2ページ目は残り2件
    expect(page2Items).toHaveLength(2);
    expect(page2Meta).toEqual({ hasNext: false, nextCursor: null });

    // Then: 重複なし（ID が交差しない）
    const page1Ids = new Set(page1Items.map((p) => p.id));
    const page2Ids = new Set(page2Items.map((p) => p.id));
    const overlap = [...page1Ids].filter((id) => page2Ids.has(id));
    expect(overlap).toHaveLength(0);

    // Then: 欠落なし（合計7件）
    expect(page1Items.length + page2Items.length).toBe(7);
  });

  it("ページネーションで全件辿って件数が一致する", async () => {
    // Given: 投稿を12件作成
    await insertPostsWithStaggeredCreatedAt(12);

    const limit = normalizeLimit(5);
    const allIds: string[] = [];
    let cursor: Cursor | null = null;
    let hasNext = true;

    // When: 全ページを巡回
    while (hasNext) {
      const rows = await withAnonymousRole(db, (tx) =>
        listPostsWithLikes(tx, null, { limit, cursor }),
      );
      if (rows instanceof Error) throw rows;

      const meta = buildPaginationMeta(rows, limit);
      const items = trimItems(rows, limit);

      allIds.push(...items.map((p) => p.id));
      hasNext = meta.hasNext;
      cursor = meta.nextCursor;
    }

    // Then: 重複なしで全12件
    expect(allIds).toHaveLength(12);
    expect(new Set(allIds).size).toBe(12);
  });

  it("同一 createdAt のレコードが複数あっても id で安定ソートされ重複・欠落がない", async () => {
    // Given: 同じ時刻の投稿を6件作成
    const author = await createUser(db);
    const song = await createSong(db);
    const fixedTime = "2026-01-15T12:00:00.000Z";

    for (let i = 0; i < 6; i++) {
      await db.insert(posts).values({
        userId: author.id,
        songId: song.id,
        content: `same-time-post-${i}`,
        createdAt: fixedTime,
      });
    }

    const limit = normalizeLimit(4);

    // When: 1ページ目
    const page1Rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit }));
    if (page1Rows instanceof Error) throw page1Rows;

    const page1Meta = buildPaginationMeta(page1Rows, limit);
    const page1Items = trimItems(page1Rows, limit);

    expect(page1Items).toHaveLength(4);
    expect(page1Meta.hasNext).toBe(true);

    // When: 2ページ目
    const page2Rows = await withAnonymousRole(db, (tx) =>
      listPostsWithLikes(tx, null, { limit, cursor: page1Meta.nextCursor }),
    );
    if (page2Rows instanceof Error) throw page2Rows;

    const page2Meta = buildPaginationMeta(page2Rows, limit);
    const page2Items = trimItems(page2Rows, limit);

    // Then: 2ページ目は残り2件
    expect(page2Items).toHaveLength(2);
    expect(page2Meta).toEqual({ hasNext: false, nextCursor: null });

    // Then: 重複なし、欠落なし
    const page1Ids = new Set(page1Items.map((p) => p.id));
    const page2Ids = new Set(page2Items.map((p) => p.id));
    const overlap = [...page1Ids].filter((id) => page2Ids.has(id));
    expect(overlap).toHaveLength(0);
    expect(page1Items.length + page2Items.length).toBe(6);
  });
});
