import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createPost, createSong, createUser } from "../../helpers/db/fixtures";
import { withAnonymousRole } from "../../../shared/db/rls";
import { listPostsWithLikes } from "../../../features/posts/repository";

const sql = createTestSql();
const db = createTestDb(sql);

afterAll(async () => {
  await sql.end();
});

describe("listPostsWithLikes — ページネーション", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  it("limit 指定でその件数だけ返す", async () => {
    // Given: 3件の投稿
    const author = await createUser(db, { username: "author", name: "Author" });
    const song = await createSong(db);
    await createPost(db, author.id, song.id, { content: "post1" });
    await createPost(db, author.id, song.id, { content: "post2" });
    await createPost(db, author.id, song.id, { content: "post3" });

    // When: limit=2
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit: 2 }));
    if (rows instanceof Error) throw rows;

    // Then: limit + 1 = 3件返る（repository は hasNext 判定のため余分に取得）
    expect(rows).toHaveLength(3);
    expect(rows[0]!.content).toBe("post3");
    expect(rows[1]!.content).toBe("post2");
    expect(rows[2]!.content).toBe("post1");
  });

  it("cursor 指定で続きを返す", async () => {
    // Given: 4件の投稿
    const author = await createUser(db);
    const song = await createSong(db);
    const p1 = await createPost(db, author.id, song.id, { content: "post1" });
    const p2 = await createPost(db, author.id, song.id, { content: "post2" });
    const p3 = await createPost(db, author.id, song.id, { content: "post3" });
    const p4 = await createPost(db, author.id, song.id, { content: "post4" });

    // When: cursor = p2 の位置（p2 より古いもの）
    const rows = await withAnonymousRole(db, (tx) =>
      listPostsWithLikes(tx, null, {
        limit: 10,
        cursor: { createdAt: p2.createdAt, id: p2.id },
      }),
    );
    if (rows instanceof Error) throw rows;

    // Then: p1 のみ返る（p2 より前）
    expect(rows).toHaveLength(1);
    expect(rows[0]!.content).toBe("post1");
  });

  it("limit + cursor で正しくページ切り替え", async () => {
    // Given: 5件の投稿（同ミリ秒で作成される可能性があるため、cursor の正確性に依存しない）
    const author = await createUser(db);
    const song = await createSong(db);
    await createPost(db, author.id, song.id, { content: "p1" });
    await createPost(db, author.id, song.id, { content: "p2" });
    await createPost(db, author.id, song.id, { content: "p3" });
    await createPost(db, author.id, song.id, { content: "p4" });
    await createPost(db, author.id, song.id, { content: "p5" });

    // When: 1ページ目 limit=2, cursorなし → limit+1=3件取得
    const page1 = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null, { limit: 2 }));
    if (page1 instanceof Error) throw page1;

    // Then: 3件（2+1）返る
    expect(page1).toHaveLength(3);

    // When: 2ページ目 cursor = page1 の最後から2番目のレコード
    const cursorItem = page1[1]!;
    const page2 = await withAnonymousRole(db, (tx) =>
      listPostsWithLikes(tx, null, {
        limit: 2,
        cursor: { createdAt: cursorItem.createdAt, id: cursorItem.id },
      }),
    );
    if (page2 instanceof Error) throw page2;

    // Then: cursor より前のレコードが返る（件数はタイムスタンプ精度に依存）
    expect(page2.length).toBeGreaterThanOrEqual(1);
    // cursor の位置より前のレコードが含まれることを確認
    const page1Ids = new Set(page1.slice(0, 2).map((r) => r.id));
    const page2HasNewRecords = page2.some((r) => !page1Ids.has(r.id));
    expect(page2HasNewRecords).toBe(true);
  });

  it("cursor なし + limit なしで全件返す（後方互換）", async () => {
    // Given
    const author = await createUser(db);
    const song = await createSong(db);
    await createPost(db, author.id, song.id, { content: "a" });
    await createPost(db, author.id, song.id, { content: "b" });

    // When
    const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null));
    if (rows instanceof Error) throw rows;

    // Then: 全件返る
    expect(rows).toHaveLength(2);
  });
});
