import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { describe, expect, it, vi } from "vitest";
import { AppleMusicError, DbError, RlsError } from "@repo/errors";

const mocks = vi.hoisted(() => ({
  addFavoriteSong: vi.fn(),
  createSongFull: vi.fn(),
  fetchSong: vi.fn(),
  findOrCreateArtists: vi.fn(),
  findSongByAppleMusicId: vi.fn(),
  listFavoriteSongs: vi.fn(),
  removeFavoriteSong: vi.fn(),
  songExistsByAppleMusicId: vi.fn(),
  withRls: vi.fn(),
}));

vi.mock("../../../shared/db/rls", () => ({
  withRls: mocks.withRls,
}));

vi.mock("../../../shared/apple-music", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/apple-music")>();
  return { ...original, fetchSong: mocks.fetchSong };
});

vi.mock("../../../features/favorite-songs/repository", () => ({
  addFavoriteSong: mocks.addFavoriteSong,
  listFavoriteSongs: mocks.listFavoriteSongs,
  removeFavoriteSong: mocks.removeFavoriteSong,
}));

vi.mock("../../../features/songs/repository", () => ({
  createSongFull: mocks.createSongFull,
  findSongByAppleMusicId: mocks.findSongByAppleMusicId,
  songExistsByAppleMusicId: mocks.songExistsByAppleMusicId,
}));

vi.mock("../../../features/artists/apple-music-sync", () => ({
  findOrCreateArtists: mocks.findOrCreateArtists,
}));

import {
  deleteFavoriteSong,
  getFavoriteSongs,
  registerFavoriteSong,
} from "../../../features/favorite-songs/usecase";

const session = {
  sub: "firebase-user-id",
  uid: "firebase-user-id",
  email: "test@example.com",
} as DecodedIdToken;

const db = { kind: "db" } as never;
const tx = { kind: "transaction" } as never;

const favoriteRow = {
  userId: "user-id",
  songId: "song-id",
  comment: "great",
  emoji: "star",
  color: "#ff0000",
  createdAt: "2026-05-02T00:00:00.000Z",
};

describe("favorite songs usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    mocks.withRls.mockImplementation(async (_db, _session, fn) => await fn(tx, "user-id"));
  });

  describe("getFavoriteSongs", () => {
    it("maps repository rows into the public response shape", async () => {
      const addedAt = "2026-05-02T00:00:00.000Z";
      mocks.listFavoriteSongs.mockResolvedValue([
        {
          favorite: {
            comment: "great",
            emoji: "star",
            color: "#ff0000",
            createdAt: addedAt,
          },
          song: {
            id: "song-id",
            title: "Song",
            appleMusicId: "apple-music-song-id",
          },
        },
      ]);

      const result = await getFavoriteSongs(session, db);

      expect(result).toMatchObject({
        favorites: [
          {
            song: {
              id: "song-id",
              title: "Song",
              appleMusicId: "apple-music-song-id",
            },
            comment: "great",
            emoji: "star",
            color: "#ff0000",
            addedAt,
          },
        ],
        pagination: {
          hasNext: false,
          nextCursor: null,
        },
      });
      expect(mocks.listFavoriteSongs).toHaveBeenCalledWith(tx, "user-id", {
        limit: 20,
        cursor: undefined,
      });
    });

    it("wraps RLS failures as the favorite-song list error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await getFavoriteSongs(session, db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入り楽曲の取得に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });

  describe("registerFavoriteSong", () => {
    it("registers an existing song without calling Apple Music", async () => {
      mocks.findSongByAppleMusicId.mockResolvedValue({
        id: "song-id",
        title: "Song",
        appleMusicId: "apple-music-song-id",
      });
      mocks.addFavoriteSong.mockResolvedValue([favoriteRow]);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: "great",
          emoji: "star",
          color: "#ff0000",
        },
        db,
      );

      expect(result).toEqual({ favorite: favoriteRow });
      expect(mocks.fetchSong).not.toHaveBeenCalled();
      expect(mocks.addFavoriteSong).toHaveBeenCalledWith(tx, "user-id", "song-id", {
        comment: "great",
        emoji: "star",
        color: "#ff0000",
      });
    });

    it("fetches from Apple Music, creates the song, then registers the favorite", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(false);
      mocks.fetchSong.mockResolvedValue({
        id: "apple-music-song-id",
        attributes: {
          name: "New Song",
          durationInMillis: 123_456,
          isrc: "JPABC2600001",
          genreNames: ["Pop", "Rock"],
        },
        relationships: {
          artists: {
            data: [
              { id: "am-artist-001", attributes: { name: "Artist One" } },
              { id: "am-artist-002", attributes: { name: "Artist Two" } },
            ],
          },
        },
      });
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      mocks.findOrCreateArtists.mockResolvedValue(["artist-id-1", "artist-id-2"]);
      mocks.createSongFull.mockResolvedValue({
        id: "created-song-id",
        title: "New Song",
        appleMusicId: "apple-music-song-id",
        length: 124,
        isrcs: "JPABC2600001",
      });
      mocks.addFavoriteSong.mockResolvedValue([{ ...favoriteRow, songId: "created-song-id" }]);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toEqual({ favorite: { ...favoriteRow, songId: "created-song-id" } });
      expect(mocks.addFavoriteSong).toHaveBeenCalledWith(tx, "user-id", "created-song-id", {
        comment: null,
        emoji: null,
        color: null,
      });
    });

    it("detects a soft-delete race between existence check and transaction, retries once, and succeeds", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(true);
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      mocks.fetchSong.mockResolvedValue({
        id: "apple-music-song-id",
        attributes: {
          name: "Race Song",
          durationInMillis: 123_456,
          isrc: "JPABC2600001",
          genreNames: ["Pop", "Rock"],
        },
        relationships: {
          artists: {
            data: [{ id: "am-artist-001", attributes: { name: "Race Artist" } }],
          },
        },
      });
      mocks.findOrCreateArtists.mockResolvedValue(["race-artist-id"]);
      mocks.createSongFull.mockResolvedValue({
        id: "created-song-id",
        title: "Race Song",
        appleMusicId: "apple-music-song-id",
      });
      mocks.addFavoriteSong.mockResolvedValue([{ ...favoriteRow, songId: "created-song-id" }]);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toEqual({ favorite: { ...favoriteRow, songId: "created-song-id" } });
      expect(mocks.withRls).toHaveBeenCalledTimes(2);
      expect(mocks.fetchSong).toHaveBeenCalledTimes(1);
    });

    it("returns fetchSong errors from the retry path without a second transaction", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(true);
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      const apiError = new AppleMusicError({
        message: "指定された楽曲が見つかりません。",
        statusCode: 404,
      });
      mocks.fetchSong.mockResolvedValue(apiError);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBe(apiError);
      expect(mocks.withRls).toHaveBeenCalledTimes(1);
    });

    it("wraps retry-transaction failures as DbError 500", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(true);
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      mocks.fetchSong.mockResolvedValue({
        id: "apple-music-song-id",
        attributes: {
          name: "Race Song",
          durationInMillis: 123_456,
          isrc: "JPABC2600001",
          genreNames: ["Pop", "Rock"],
        },
        relationships: {
          artists: {
            data: [{ id: "am-artist-001", attributes: { name: "Race Artist" } }],
          },
        },
      });
      const rlsError = new RlsError({ message: "Transaction failed." });
      mocks.withRls
        .mockImplementationOnce(async (_db, _s, fn) => fn(tx, "user-id"))
        .mockResolvedValueOnce(rlsError);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入り楽曲の登録に失敗しました。",
        statusCode: 500,
        cause: rlsError,
      });
      expect(mocks.withRls).toHaveBeenCalledTimes(2);
    });

    it("wraps findOrCreateArtists failures as DbError inside the transaction", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(false);
      mocks.fetchSong.mockResolvedValue({
        id: "apple-music-song-id",
        attributes: {
          name: "New Song",
          durationInMillis: 123_456,
          isrc: "JPABC2600001",
          genreNames: [],
        },
        relationships: {
          artists: {
            data: [{ id: "am-artist-001", attributes: { name: "Artist One" } }],
          },
        },
      });
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      const cause = new Error("connection reset");
      mocks.findOrCreateArtists.mockRejectedValue(cause);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "アーティストの解決に失敗しました。",
        statusCode: 500,
        cause,
      });
      expect(mocks.createSongFull).not.toHaveBeenCalled();
    });

    it("returns Apple Music failures before opening an RLS transaction", async () => {
      mocks.songExistsByAppleMusicId.mockResolvedValue(false);
      const error = new DbError({
        message: "指定された楽曲が見つかりません。",
        statusCode: 404,
      });
      mocks.fetchSong.mockResolvedValue(error);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "missing-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBe(error);
      expect(mocks.withRls).not.toHaveBeenCalled();
    });

    it("preserves non-500 repository errors such as duplicate favorites", async () => {
      const error = new DbError({
        message: "この楽曲は既にお気に入りに登録されています。",
        statusCode: 409,
      });
      mocks.findSongByAppleMusicId.mockResolvedValue({ id: "song-id" });
      mocks.addFavoriteSong.mockResolvedValue(error);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBe(error);
    });

    it("returns a 409 domain error when addFavoriteSong ignores a duplicate via onConflictDoNothing", async () => {
      mocks.findSongByAppleMusicId.mockResolvedValue({ id: "song-id" });
      mocks.addFavoriteSong.mockResolvedValue([]);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "この楽曲は既にお気に入りに登録されています。",
        statusCode: 409,
        problemSlug: "favorite-song-already-exists",
      });
    });

    it("returns a 409 DbError when addFavoriteSong rejects with the primary-key constraint violation", async () => {
      const { createDrizzleConstraintError } = await import("../../helpers/postgres-error");
      const constraintError = createDrizzleConstraintError({
        constraintName: "favorite_songs_pkey",
        query: 'insert into "favorite_songs"',
      });
      mocks.findSongByAppleMusicId.mockResolvedValue({ id: "song-id" });
      mocks.addFavoriteSong.mockRejectedValue(constraintError);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "この楽曲は既にお気に入りに登録されています。",
        statusCode: 409,
        cause: constraintError,
      });
    });

    it("wraps RLS failures as the favorite-song registration error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await registerFavoriteSong(
        session,
        {
          appleMusicId: "apple-music-song-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入り楽曲の登録に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });

  describe("deleteFavoriteSong", () => {
    it("returns deleted true when the repository removes a favorite", async () => {
      mocks.findSongByAppleMusicId.mockResolvedValue({ id: "song-id" });
      mocks.removeFavoriteSong.mockResolvedValue([{ songId: "song-id" }]);

      const result = await deleteFavoriteSong(session, "apple-music-song-id", db);

      expect(result).toEqual({ deleted: true });
      expect(mocks.findSongByAppleMusicId).toHaveBeenCalledWith(tx, "apple-music-song-id");
      expect(mocks.removeFavoriteSong).toHaveBeenCalledWith(tx, "user-id", "song-id");
    });

    it("returns 404 when there is no favorite to remove", async () => {
      mocks.findSongByAppleMusicId.mockResolvedValue(null);

      const result = await deleteFavoriteSong(session, "apple-music-song-id", db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入り楽曲が見つかりません。",
        statusCode: 404,
      });
    });
  });
});
