import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { findOrCreateArtists } from "../../../features/artists/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db/client";
import { createArtist } from "../../helpers/db/fixtures";
import { artists } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

describe("findOrCreateArtists", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("新しいアーティストを登録してIDを返す", async () => {
    // When
    const ids = await findOrCreateArtists(db, [
      { appleMusicId: "am-a", name: "Artist A" },
      { appleMusicId: "am-b", name: "Artist B" },
    ]);

    // Then
    expect(ids).toHaveLength(2);
  });

  it("既存アーティストのIDをそのまま返す（重複作成しない）", async () => {
    // Given
    const existing = await createArtist(db, { appleMusicId: "am-existing" });

    // When
    const ids = await findOrCreateArtists(db, [
      { appleMusicId: "am-existing", name: "Existing Artist" },
      { appleMusicId: "am-new", name: "New Artist" },
    ]);

    // Then
    expect(ids).toContain(existing.id);
    expect(ids).toHaveLength(2);

    const rows = await db.select({ id: artists.id }).from(artists);
    expect(rows).toHaveLength(2);
  });

  it("名前が空のエントリはスキップする", async () => {
    // When
    const ids = await findOrCreateArtists(db, [
      { appleMusicId: "am-empty", name: "" },
      { appleMusicId: "am-valid", name: "Valid" },
    ]);

    // Then
    expect(ids).toHaveLength(1);
  });
});
