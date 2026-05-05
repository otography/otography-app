import { eq, sql as drizzleSql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DbError } from "@repo/errors";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { findOrCreateArtists } from "../../../features/artists/repository";
import { listPostsWithLikes, findPostByIdWithLikes } from "../../../features/posts/repository";
import { createTestDb, createTestSql, resetPublicTables } from "../../helpers/db";
import { isPostgresCheckViolation } from "../../../shared/db/postgres-error";
import { withAnonymousRole, withAuthenticatedRole } from "../../../shared/db/rls";
import {
  artists,
  favoriteArtists,
  favoriteSongs,
  genres,
  postLikes,
  songArtists,
  songGenres,
  songs,
  posts,
  users,
} from "../../../shared/db/schema";

const sql = createTestSql();
const db = createTestDb(sql);

describe("database schema", () => {
  beforeEach(async () => {
    await resetPublicTables(sql);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("applies migrations with RLS enabled on public tables", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN (
          'artists',
          'favorite_artists',
          'favorite_songs',
          'genres',
          'group_songs',
          'groups',
          'post_likes',
          'posts',
          'song_artists',
          'song_genres',
          'songs',
          'users'
        )
      ORDER BY relname
    `;

    expect(rows).toEqual([
      { relname: "artists", relrowsecurity: true },
      { relname: "favorite_artists", relrowsecurity: true },
      { relname: "favorite_songs", relrowsecurity: true },
      { relname: "genres", relrowsecurity: true },
      { relname: "group_songs", relrowsecurity: true },
      { relname: "groups", relrowsecurity: true },
      { relname: "post_likes", relrowsecurity: true },
      { relname: "posts", relrowsecurity: true },
      { relname: "song_artists", relrowsecurity: true },
      { relname: "song_genres", relrowsecurity: true },
      { relname: "songs", relrowsecurity: true },
      { relname: "users", relrowsecurity: true },
    ]);
  });

  it("hardens public helper functions and views for Supabase linting", async () => {
    const functions = await sql<{ proname: string; search_path: string | null }[]>`
      SELECT
        proname,
        (
          SELECT split_part(option, '=', 2)
          FROM unnest(proconfig) option
          WHERE option LIKE 'search_path=%'
        ) AS search_path
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('gen_random_uuid_v7', 'uuid_generate_v7')
      ORDER BY proname
    `;

    expect(functions).toEqual([
      { proname: "gen_random_uuid_v7", search_path: "pg_catalog" },
      { proname: "uuid_generate_v7", search_path: "pg_catalog" },
    ]);

    const views = await sql<{ security_invoker: string | null }[]>`
      SELECT (
        SELECT split_part(option, '=', 2)
        FROM unnest(reloptions) option
        WHERE option LIKE 'security_invoker=%'
      ) AS security_invoker
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = 'user_profiles'
    `;

    expect(views).toEqual([{ security_invoker: null }]);
  });

  it("resolves Firebase IDs only for active users", async () => {
    const [activeUser] = await db
      .insert(users)
      .values({ firebaseId: "firebase-active-user" })
      .returning({ id: users.id });
    await db.insert(users).values({
      firebaseId: "firebase-deleted-user",
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(activeUser).toBeDefined();

    // アプリは postgres ロールのままトランザクション外で呼ぶ（withRls の resolveFirebaseId と同じパターン）
    const activeResult = await db.execute<{ user_id: string | null }>(drizzleSql`
      SELECT public.resolve_firebase_id('firebase-active-user') AS user_id
    `);
    const deletedResult = await db.execute<{ user_id: string | null }>(drizzleSql`
      SELECT public.resolve_firebase_id('firebase-deleted-user') AS user_id
    `);

    expect(activeResult).toEqual([{ user_id: activeUser!.id }]);
    expect(deletedResult).toEqual([{ user_id: null }]);
  });

  it("allows server-side user sync through a narrow definer function", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(drizzleSql.raw("set local role authenticated"));

      const inserted = await tx.execute<{ id: string }>(drizzleSql`
        SELECT id FROM public.sync_firebase_user('firebase-owner-sync')
      `);
      const restored = await tx.execute<{ id: string }>(drizzleSql`
        SELECT id FROM public.sync_firebase_user('firebase-owner-sync')
      `);

      expect(inserted).toHaveLength(1);
      expect(restored).toEqual(inserted);
    });
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

  describe("findOrCreateArtists (batch find-or-create)", () => {
    it("creates new artists and returns their IDs", async () => {
      const artistIds = await findOrCreateArtists(db, [
        { appleMusicId: "am-artist-a", name: "Artist A" },
        { appleMusicId: "am-artist-b", name: "Artist B" },
      ]);

      expect(artistIds).toHaveLength(2);

      const rows = await db
        .select({ appleMusicId: artists.appleMusicId, name: artists.name })
        .from(artists);
      expect(rows).toMatchObject([
        { appleMusicId: "am-artist-a", name: "Artist A" },
        { appleMusicId: "am-artist-b", name: "Artist B" },
      ]);
    });

    it("returns existing artist IDs without creating duplicates", async () => {
      const [created] = await db
        .insert(artists)
        .values({ name: "Existing Artist", appleMusicId: "am-existing" })
        .returning({ id: artists.id });

      const artistIds = await findOrCreateArtists(db, [
        { appleMusicId: "am-existing", name: "Existing Artist" },
        { appleMusicId: "am-new", name: "New Artist" },
      ]);

      expect(artistIds).toHaveLength(2);
      expect(artistIds).toContain(created!.id);

      const rows = await db.select({ appleMusicId: artists.appleMusicId }).from(artists);
      expect(rows).toHaveLength(2);
    });

    it("skips entries with empty names", async () => {
      const artistIds = await findOrCreateArtists(db, [
        { appleMusicId: "am-no-name", name: "" },
        { appleMusicId: "am-has-name", name: "Has Name" },
      ]);

      expect(artistIds).toHaveLength(1);

      const rows = await db.select({ appleMusicId: artists.appleMusicId }).from(artists);
      expect(rows).toEqual([{ appleMusicId: "am-has-name" }]);
    });
  });

  describe("genres and song_genres (find-or-create + sync)", () => {
    it("creates genres and links them to songs via song_genres", async () => {
      const [song] = await db
        .insert(songs)
        .values({ title: "Genre Test Song", appleMusicId: "am-genre-test" })
        .returning({ id: songs.id });

      // INSERT ON CONFLICT DO NOTHING でジャンルを作成
      await db
        .insert(artists)
        .values({ name: "Genre Artist", appleMusicId: "am-genre-artist" })
        .returning({ id: artists.id });

      // genres の find-or-create（INSERT ON CONFLICT DO NOTHING → SELECT）
      await db
        .insert(genres)
        .values([{ name: "J-Pop" }, { name: "Rock" }])
        .onConflictDoNothing({ target: genres.name });

      const genreRows = await db.select({ id: genres.id, name: genres.name }).from(genres);
      expect(genreRows).toHaveLength(2);

      // song_genres に紐付け
      await db.insert(songGenres).values(
        genreRows.map((g) => ({
          songId: song!.id,
          genreId: g.id,
        })),
      );

      // 検証: song_genres 経由でジャンル名を取得
      const result = await db
        .select({ name: genres.name })
        .from(songGenres)
        .innerJoin(genres, eq(songGenres.genreId, genres.id))
        .where(eq(songGenres.songId, song!.id));

      expect(result.map((r) => r.name).sort()).toEqual(["J-Pop", "Rock"]);
    });

    it("replaces song_genres on full sync (delete + insert)", async () => {
      const [song] = await db
        .insert(songs)
        .values({ title: "Sync Test Song", appleMusicId: "am-sync-test" })
        .returning({ id: songs.id });

      // 初回ジャンル紐付け
      await db.insert(genres).values([{ name: "Pop" }, { name: "Electronic" }, { name: "Jazz" }]);

      const allGenres = await db.select({ id: genres.id, name: genres.name }).from(genres);

      await db
        .insert(songGenres)
        .values(allGenres.map((g) => ({ songId: song!.id, genreId: g.id })));

      // 全置換: DELETE → INSERT（Pop のみ）
      await db.delete(songGenres).where(drizzleSql`${songGenres.songId} = ${song!.id}`);

      const popGenre = allGenres.find((g) => g.name === "Pop")!;
      await db.insert(songGenres).values({
        songId: song!.id,
        genreId: popGenre.id,
      });

      // 検証: Popのみ残っている
      const result = await db
        .select({ name: genres.name })
        .from(songGenres)
        .innerJoin(genres, eq(songGenres.genreId, genres.id))
        .where(eq(songGenres.songId, song!.id));

      expect(result).toEqual([{ name: "Pop" }]);
    });
  });

  describe("RLS policies (withAuthenticatedRole / withAnonymousRole)", () => {
    it("anon can read active songs and artists but not insert", async () => {
      await db.insert(songs).values({ title: "Public Song", appleMusicId: "am-rls-song-1" });
      await db.insert(artists).values({ name: "Public Artist", appleMusicId: "am-rls-artist-1" });

      // anon で SELECT（ポリシー: deleted_at IS NULL）
      const songRows = await withAnonymousRole(db, (tx) =>
        tx.select({ title: songs.title }).from(songs),
      );
      expect(songRows).toEqual([{ title: "Public Song" }]);

      const artistRows = await withAnonymousRole(db, (tx) =>
        tx.select({ name: artists.name }).from(artists),
      );
      expect(artistRows).toEqual([{ name: "Public Artist" }]);

      // anon で INSERT（ポリシーなし → エラー）
      const insertResult = await withAnonymousRole(db, (tx) =>
        tx
          .insert(songs)
          .values({ title: "Anon Song", appleMusicId: "am-anon-song" })
          .returning({ id: songs.id }),
      );
      expect(insertResult).toBeInstanceOf(Error);
    });

    it("authenticated can insert songs with song_artists and song_genres", async () => {
      const [artist] = await db
        .insert(artists)
        .values({ name: "RLS Artist", appleMusicId: "am-rls-artist-2" })
        .returning({ id: artists.id });

      const songResult = await withAuthenticatedRole(db, async (tx) => {
        const [s] = await tx
          .insert(songs)
          .values({ title: "RLS Song", appleMusicId: "am-rls-song-2" })
          .returning({ id: songs.id, title: songs.title });
        return s;
      });

      expect(songResult).not.toBeInstanceOf(Error);
      const songId = (songResult as { id: string }).id;

      // song_artists INSERT（authenticated ロール）
      await withAuthenticatedRole(db, async (tx) => {
        await tx.insert(songArtists).values({ songId, artistId: artist!.id, isGuest: false });
      });

      // song_genres INSERT（authenticated ロール）
      await withAuthenticatedRole(db, async (tx) => {
        await tx
          .insert(genres)
          .values({ name: "RLS Genre" })
          .onConflictDoNothing({ target: genres.name });
        const [g] = await tx
          .select({ id: genres.id })
          .from(genres)
          .where(eq(genres.name, "RLS Genre"));
        await tx.insert(songGenres).values({ songId, genreId: g!.id });
      });

      // 検証: anon でも song_artists / song_genres 経由で読める
      const artistLinks = await withAnonymousRole(db, (tx) =>
        tx
          .select({ name: artists.name })
          .from(songArtists)
          .innerJoin(artists, eq(songArtists.artistId, artists.id))
          .where(eq(songArtists.songId, songId)),
      );
      expect(artistLinks).not.toBeInstanceOf(Error);
      expect(artistLinks).toEqual([{ name: "RLS Artist" }]);

      const genreLinks = await withAnonymousRole(db, (tx) =>
        tx
          .select({ name: genres.name })
          .from(songGenres)
          .innerJoin(genres, eq(songGenres.genreId, genres.id))
          .where(eq(songGenres.songId, songId)),
      );
      expect(genreLinks).not.toBeInstanceOf(Error);
      expect(genreLinks).toEqual([{ name: "RLS Genre" }]);
    });

    it("genres SELECT hides soft-deleted rows", async () => {
      await db
        .insert(genres)
        .values([{ name: "Active Genre" }, { name: "Deleted Genre", deletedAt: new Date() }]);

      const rows = await withAnonymousRole(db, (tx) =>
        tx.select({ name: genres.name }).from(genres),
      );

      expect(rows).toEqual([{ name: "Active Genre" }]);
    });

    it("favorite_artists / favorite_songs are scoped to requesting user", async () => {
      const [user1] = await db
        .insert(users)
        .values({ firebaseId: "firebase-rls-user-1" })
        .returning({ id: users.id });
      const [user2] = await db
        .insert(users)
        .values({ firebaseId: "firebase-rls-user-2" })
        .returning({ id: users.id });
      const [artist] = await db
        .insert(artists)
        .values({ name: "RLS Fav Artist", appleMusicId: "am-rls-fav-artist" })
        .returning({ id: artists.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "RLS Fav Song", appleMusicId: "am-rls-fav-song" })
        .returning({ id: songs.id });

      // postgres 権限で両ユーザーのお気に入りを作成
      await db.insert(favoriteArtists).values([
        { userId: user1!.id, artistId: artist!.id },
        { userId: user2!.id, artistId: artist!.id },
      ]);
      await db.insert(favoriteSongs).values([
        { userId: user1!.id, songId: song!.id },
        { userId: user2!.id, songId: song!.id },
      ]);

      // user1 として SELECT → 自分のだけ取得
      const favArtists = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user1!.id })}, true)`,
        );
        await tx.execute(drizzleSql.raw("set local role authenticated"));
        return tx.select({ userId: favoriteArtists.userId }).from(favoriteArtists);
      });
      expect(favArtists).toEqual([{ userId: user1!.id }]);

      const favSongs = await db.transaction(async (tx) => {
        await tx.execute(
          drizzleSql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user1!.id })}, true)`,
        );
        await tx.execute(drizzleSql.raw("set local role authenticated"));
        return tx.select({ userId: favoriteSongs.userId }).from(favoriteSongs);
      });
      expect(favSongs).toEqual([{ userId: user1!.id }]);
    });

    it("posts SELECT policy: anon sees active, authenticated sees own", async () => {
      const [user] = await db
        .insert(users)
        .values({ firebaseId: "firebase-rls-post-user" })
        .returning({ id: users.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "RLS Post Song", appleMusicId: "am-rls-post-song" })
        .returning({ id: songs.id });

      // postgres 権限で投稿作成 + 論理削除投稿
      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content)
        VALUES (${user!.id}, ${song!.id}, 'active post')
      `);
      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content, deleted_at)
        VALUES (${user!.id}, ${song!.id}, 'deleted post', now())
      `);

      // anon: deleted_at IS NULL のみ見える
      const anonPosts = await withAnonymousRole(db, (tx) =>
        tx.select({ content: posts.content }).from(posts),
      );
      expect(anonPosts).toEqual([{ content: "active post" }]);
    });
  });

  describe("listPostsWithLikes / findPostByIdWithLikes", () => {
    it("投稿一覧に post / author / like 情報がすべて含まれる", async () => {
      const [author] = await db
        .insert(users)
        .values({ firebaseId: "firebase-list-author", username: "listauthor", name: "List Author" })
        .returning({ id: users.id });
      const [liker] = await db
        .insert(users)
        .values({ firebaseId: "firebase-list-liker" })
        .returning({ id: users.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "List Song", appleMusicId: "am-list-song" })
        .returning({ id: songs.id });

      // postgres 権限で投稿作成
      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content)
        VALUES (${author!.id}, ${song!.id}, 'hello world')
      `);
      const [post] = await db.select({ id: posts.id }).from(posts);

      // liker がいいね
      await db.insert(postLikes).values({ userId: liker!.id, postId: post!.id });

      // liker として取得 → isLiked: true, likeCount: 1
      const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, liker!.id));
      if (rows instanceof Error) throw rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: post!.id,
        userId: author!.id,
        songId: song!.id,
        content: "hello world",
        author: { username: "listauthor", name: "List Author" },
        likeCount: 1,
        isLiked: true,
      });

      // 未ログイン (userId=null) → isLiked: false, likeCount: 1
      const anonRows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null));
      if (anonRows instanceof Error) throw anonRows;
      expect(anonRows).toHaveLength(1);
      expect(anonRows[0]).toMatchObject({
        likeCount: 1,
        isLiked: false,
      });
    });

    it("投稿詳細に post / author / like 情報がすべて含まれる", async () => {
      const [author] = await db
        .insert(users)
        .values({
          firebaseId: "firebase-detail-author",
          username: "detailauthor",
          name: "Detail Author",
        })
        .returning({ id: users.id });
      const [other] = await db
        .insert(users)
        .values({ firebaseId: "firebase-detail-other" })
        .returning({ id: users.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "Detail Song", appleMusicId: "am-detail-song" })
        .returning({ id: songs.id });

      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content)
        VALUES (${author!.id}, ${song!.id}, 'detail content')
      `);
      const [post] = await db.select({ id: posts.id }).from(posts);

      // 2人がいいね
      await db.insert(postLikes).values([
        { userId: author!.id, postId: post!.id },
        { userId: other!.id, postId: post!.id },
      ]);

      // other として詳細取得
      const result = await withAnonymousRole(db, (tx) =>
        findPostByIdWithLikes(tx, post!.id, other!.id),
      );
      expect(result).toMatchObject({
        id: post!.id,
        userId: author!.id,
        songId: song!.id,
        content: "detail content",
        author: { username: "detailauthor", name: "Detail Author" },
        likeCount: 2,
        isLiked: true,
      });

      // author はいいねしているので isLiked: true
      const authorResult = await withAnonymousRole(db, (tx) =>
        findPostByIdWithLikes(tx, post!.id, author!.id),
      );
      expect(authorResult).toMatchObject({ likeCount: 2, isLiked: true });

      // 未ログイン → isLiked: false
      const anonResult = await withAnonymousRole(db, (tx) =>
        findPostByIdWithLikes(tx, post!.id, null),
      );
      expect(anonResult).toMatchObject({ likeCount: 2, isLiked: false });
    });

    it("いいねなしの投稿は likeCount=0, isLiked=false になる", async () => {
      const [author] = await db
        .insert(users)
        .values({ firebaseId: "firebase-nolike-author", username: "nolike", name: "NoLike" })
        .returning({ id: users.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "NoLike Song", appleMusicId: "am-nolike-song" })
        .returning({ id: songs.id });

      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content)
        VALUES (${author!.id}, ${song!.id}, 'no likes yet')
      `);
      const [post] = await db.select({ id: posts.id }).from(posts);

      const result = await withAnonymousRole(db, (tx) =>
        findPostByIdWithLikes(tx, post!.id, author!.id),
      );
      expect(result).toMatchObject({
        likeCount: 0,
        isLiked: false,
      });
    });

    it("soft-deleted 投稿は一覧にも詳細にも含まれない", async () => {
      const [author] = await db
        .insert(users)
        .values({ firebaseId: "firebase-deleted-author", username: "deleted", name: "Deleted" })
        .returning({ id: users.id });
      const [song] = await db
        .insert(songs)
        .values({ title: "Deleted Song", appleMusicId: "am-deleted-song" })
        .returning({ id: songs.id });

      await db.execute(drizzleSql`
        INSERT INTO posts (user_id, song_id, content, deleted_at)
        VALUES (${author!.id}, ${song!.id}, 'deleted post', now())
      `);
      const [deletedPost] = await db.select({ id: posts.id }).from(posts);

      // 一覧
      const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, null));
      expect(rows).toHaveLength(0);

      // 詳細
      const result = await withAnonymousRole(db, (tx) =>
        findPostByIdWithLikes(tx, deletedPost!.id, null),
      );
      expect(result).toBeNull();
    });
  });
});
