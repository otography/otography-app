import { sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DbError } from "@repo/errors";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db";
import { isPostgresCheckViolation } from "../../../shared/db/postgres-error";
import { favoriteSongs, songs, users } from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

describe("database schema", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("applies migrations with RLS enabled on protected tables", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('users', 'posts')
      ORDER BY relname
    `;

    expect(rows).toEqual([
      { relname: "posts", relrowsecurity: true },
      { relname: "users", relrowsecurity: true },
    ]);
  });

  it("allows unfinished profiles but rejects blank usernames", async () => {
    await db.insert(users).values({ firebaseId: "firebase-user-without-profile" });

    const result = await db
      .insert(users)
      .values({
        firebaseId: "firebase-user-with-blank-username",
        username: "   ",
      })
      .catch((e) => e);

    expect(isPostgresCheckViolation(result, "users_username_min_length")).toBe(true);
  });

  it("reports duplicate favorite songs through the repository contract", async () => {
    const [user] = await db
      .insert(users)
      .values({ firebaseId: "firebase-user-1" })
      .returning({ id: users.id });
    const [song] = await db
      .insert(songs)
      .values({ title: "Song", appleMusicId: "apple-music-song-1" })
      .returning({ id: songs.id });

    expect(user).toBeDefined();
    expect(song).toBeDefined();

    await db.transaction(async (tx) => {
      await tx.insert(favoriteSongs).values({ userId: user!.id, songId: song!.id });

      const result = await addFavoriteSong(tx, user!.id, song!.id, {
        comment: null,
        emoji: null,
        color: null,
      });

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "この楽曲は既にお気に入りに登録されています。",
        statusCode: 409,
      });
    });
  });

  it("allows only the authenticated owner to update their post", async () => {
    const [owner] = await db
      .insert(users)
      .values({ firebaseId: "firebase-owner" })
      .returning({ id: users.id });
    const [otherUser] = await db
      .insert(users)
      .values({ firebaseId: "firebase-other" })
      .returning({ id: users.id });
    const [song] = await db
      .insert(songs)
      .values({ title: "Song", appleMusicId: "apple-music-song-2" })
      .returning({ id: songs.id });

    expect(owner).toBeDefined();
    expect(otherUser).toBeDefined();
    expect(song).toBeDefined();

    await db.execute(drizzleSql`
      INSERT INTO posts (user_id, song_id, content)
      VALUES (${owner!.id}, ${song!.id}, 'owner post')
    `);

    await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: owner!.id })}, true)`,
      );
      await tx.execute(drizzleSql.raw("set local role authenticated"));

      const result = await tx.execute(drizzleSql`
        UPDATE posts
        SET content = 'owner edit'
        WHERE user_id = ${owner!.id}
        RETURNING content
      `);

      expect(result).toEqual([{ content: "owner edit" }]);
    });

    await db.transaction(async (tx) => {
      await tx.execute(
        drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: otherUser!.id })}, true)`,
      );
      await tx.execute(drizzleSql.raw("set local role authenticated"));

      const result = await tx.execute(drizzleSql`
        UPDATE posts
        SET content = 'hacked'
        WHERE user_id = ${owner!.id}
        RETURNING content
      `);

      expect(result).toHaveLength(0);
    });
  });
});
