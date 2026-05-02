import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { describe, expect, it, vi } from "vitest";
import { DbError, RlsError } from "@repo/errors";

const mocks = vi.hoisted(() => ({
  addFavoriteSong: vi.fn(),
  createDb: vi.fn(),
  createSongFromAppleMusic: vi.fn(),
  fetchSong: vi.fn(),
  findSongByAppleMusicId: vi.fn(),
  listFavoriteSongs: vi.fn(),
  removeFavoriteSongByAppleMusicId: vi.fn(),
  withRls: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  createDb: mocks.createDb,
}));

vi.mock("../../../shared/db/rls", () => ({
  withRls: mocks.withRls,
}));

vi.mock("../../../shared/apple-music", () => ({
  fetchSong: mocks.fetchSong,
}));

vi.mock("../../../features/favorite-songs/repository", () => ({
  addFavoriteSong: mocks.addFavoriteSong,
  createSongFromAppleMusic: mocks.createSongFromAppleMusic,
  findSongByAppleMusicId: mocks.findSongByAppleMusicId,
  listFavoriteSongs: mocks.listFavoriteSongs,
  removeFavoriteSongByAppleMusicId: mocks.removeFavoriteSongByAppleMusicId,
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

const tx = { kind: "transaction" } as never;

const favoriteRow = {
  userId: "user-id",
  songId: "song-id",
  comment: "great",
  emoji: "star",
  color: "#ff0000",
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
};

const createExistingSongQuery = (rows: unknown[]) => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  })),
});

describe("favorite songs usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue(createExistingSongQuery([{ id: "existing-song-id" }]));
    mocks.withRls.mockImplementation(async (_session, fn) => await fn(tx, "user-id"));
  });

  describe("getFavoriteSongs", () => {
    it("maps repository rows into the public response shape", async () => {
      const addedAt = new Date("2026-05-02T00:00:00.000Z");
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

      const result = await getFavoriteSongs(session);

      expect(result).toEqual({
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
      });
      expect(mocks.listFavoriteSongs).toHaveBeenCalledWith(tx, "user-id");
    });

    it("wraps RLS failures as the favorite-song list error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await getFavoriteSongs(session);

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

      const result = await registerFavoriteSong(session, {
        appleMusicId: "apple-music-song-id",
        comment: "great",
        emoji: "star",
        color: "#ff0000",
      });

      expect(result).toEqual({ favorite: favoriteRow });
      expect(mocks.fetchSong).not.toHaveBeenCalled();
      expect(mocks.addFavoriteSong).toHaveBeenCalledWith(tx, "user-id", "song-id", {
        comment: "great",
        emoji: "star",
        color: "#ff0000",
      });
    });

    it("fetches and creates the song before registering when it is not stored yet", async () => {
      mocks.createDb.mockReturnValue(createExistingSongQuery([]));
      mocks.fetchSong.mockResolvedValue({
        id: "apple-music-song-id",
        attributes: {
          name: "New Song",
          durationInMillis: 123_456,
          isrc: "JPABC2600001",
        },
      });
      mocks.findSongByAppleMusicId.mockResolvedValue(null);
      mocks.createSongFromAppleMusic.mockResolvedValue([
        {
          id: "created-song-id",
          title: "New Song",
          appleMusicId: "apple-music-song-id",
        },
      ]);
      mocks.addFavoriteSong.mockResolvedValue([{ ...favoriteRow, songId: "created-song-id" }]);

      const result = await registerFavoriteSong(session, {
        appleMusicId: "apple-music-song-id",
        comment: null,
        emoji: null,
        color: null,
      });

      expect(result).toEqual({ favorite: { ...favoriteRow, songId: "created-song-id" } });
      expect(mocks.createSongFromAppleMusic).toHaveBeenCalledWith(
        tx,
        "apple-music-song-id",
        "New Song",
        123_456,
        "JPABC2600001",
      );
      expect(mocks.addFavoriteSong).toHaveBeenCalledWith(tx, "user-id", "created-song-id", {
        comment: null,
        emoji: null,
        color: null,
      });
    });

    it("returns Apple Music failures before opening an RLS transaction", async () => {
      const error = new DbError({
        message: "指定された楽曲が見つかりません。",
        statusCode: 404,
      });
      mocks.createDb.mockReturnValue(createExistingSongQuery([]));
      mocks.fetchSong.mockResolvedValue(error);

      const result = await registerFavoriteSong(session, {
        appleMusicId: "missing-song-id",
        comment: null,
        emoji: null,
        color: null,
      });

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

      const result = await registerFavoriteSong(session, {
        appleMusicId: "apple-music-song-id",
        comment: null,
        emoji: null,
        color: null,
      });

      expect(result).toBe(error);
    });

    it("wraps RLS failures as the favorite-song registration error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await registerFavoriteSong(session, {
        appleMusicId: "apple-music-song-id",
        comment: null,
        emoji: null,
        color: null,
      });

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
      mocks.removeFavoriteSongByAppleMusicId.mockResolvedValue([{ songId: "song-id" }]);

      const result = await deleteFavoriteSong(session, "apple-music-song-id");

      expect(result).toEqual({ deleted: true });
      expect(mocks.removeFavoriteSongByAppleMusicId).toHaveBeenCalledWith(
        tx,
        "user-id",
        "apple-music-song-id",
      );
    });

    it("returns 404 when there is no favorite to remove", async () => {
      mocks.removeFavoriteSongByAppleMusicId.mockResolvedValue([]);

      const result = await deleteFavoriteSong(session, "apple-music-song-id");

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入り楽曲が見つかりません。",
        statusCode: 404,
      });
    });
  });
});
