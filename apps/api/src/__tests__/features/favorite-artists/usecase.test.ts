import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbError, RlsError } from "@repo/errors";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const mocks = vi.hoisted(() => ({
  addFavoriteArtist: vi.fn(),
  artistExistsByAppleMusicId: vi.fn(),
  createArtistFromAppleMusic: vi.fn(),
  fetchArtist: vi.fn(),
  findArtistByAppleMusicId: vi.fn(),
  listFavoriteArtists: vi.fn(),
  removeFavoriteArtist: vi.fn(),
  withRls: vi.fn(),
}));

vi.mock("../../../shared/db/rls", () => ({
  withRls: mocks.withRls,
}));

vi.mock("../../../shared/apple-music", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/apple-music")>();
  return { ...original, fetchArtist: mocks.fetchArtist };
});

vi.mock("../../../features/favorite-artists/repository", () => ({
  addFavoriteArtist: mocks.addFavoriteArtist,
  listFavoriteArtists: mocks.listFavoriteArtists,
  removeFavoriteArtist: mocks.removeFavoriteArtist,
}));

vi.mock("../../../features/artists/repository", () => ({
  artistExistsByAppleMusicId: mocks.artistExistsByAppleMusicId,
  findArtistByAppleMusicId: mocks.findArtistByAppleMusicId,
}));

vi.mock("../../../features/artists/apple-music-sync", () => ({
  createArtistFromAppleMusic: mocks.createArtistFromAppleMusic,
}));

import {
  deleteFavoriteArtist,
  getFavoriteArtists,
  registerFavoriteArtist,
} from "../../../features/favorite-artists/usecase";

const session = {
  sub: "firebase-user-id",
  uid: "firebase-user-id",
  email: "test@example.com",
} as DecodedIdToken;

const db = { kind: "db" } as never;
const tx = { kind: "transaction" } as never;

const favoriteRow = {
  userId: "user-id",
  artistId: "artist-id",
  comment: "最高!",
  emoji: "🎸",
  color: "#0000ff",
  createdAt: "2026-05-02T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z",
};

describe("favorite artists usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.artistExistsByAppleMusicId.mockResolvedValue(true);
    mocks.withRls.mockImplementation(async (_db, _session, fn) => await fn(tx, "user-id"));
  });

  describe("getFavoriteArtists", () => {
    it("maps repository rows into the public response shape", async () => {
      const addedAt = "2026-05-02T00:00:00.000Z";
      mocks.listFavoriteArtists.mockResolvedValue([
        {
          favorite: {
            comment: "最高!",
            emoji: "🎸",
            color: "#0000ff",
            createdAt: addedAt,
          },
          artist: {
            id: "artist-id",
            name: "Artist",
            appleMusicId: "apple-music-artist-id",
          },
        },
      ]);

      const result = await getFavoriteArtists(session, db);

      expect(result).toMatchObject({
        favorites: [
          {
            artist: {
              id: "artist-id",
              name: "Artist",
              appleMusicId: "apple-music-artist-id",
            },
            comment: "最高!",
            emoji: "🎸",
            color: "#0000ff",
            addedAt,
          },
        ],
        pagination: {
          hasNext: false,
          nextCursor: null,
        },
      });
      expect(mocks.listFavoriteArtists).toHaveBeenCalledWith(tx, "user-id", {
        limit: 20,
        cursor: undefined,
      });
    });

    it("wraps RLS failures as the favorite-artist list error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await getFavoriteArtists(session, db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入りアーティストの取得に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });

  describe("registerFavoriteArtist", () => {
    it("registers an existing artist without calling Apple Music", async () => {
      mocks.findArtistByAppleMusicId.mockResolvedValue({
        id: "artist-id",
        name: "Artist",
        appleMusicId: "apple-music-artist-id",
      });
      mocks.addFavoriteArtist.mockResolvedValue([favoriteRow]);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: "最高!",
          emoji: "🎸",
          color: "#0000ff",
        },
        db,
      );

      expect(result).toEqual({ favorite: favoriteRow });
      expect(mocks.fetchArtist).not.toHaveBeenCalled();
      expect(mocks.addFavoriteArtist).toHaveBeenCalledWith(tx, "user-id", "artist-id", {
        comment: "最高!",
        emoji: "🎸",
        color: "#0000ff",
      });
    });

    it("fetches from Apple Music, creates the artist, then registers the favorite", async () => {
      mocks.artistExistsByAppleMusicId.mockResolvedValue(false);
      mocks.fetchArtist.mockResolvedValue({
        id: "apple-music-artist-id",
        attributes: { name: "New Artist" },
      });
      mocks.findArtistByAppleMusicId.mockResolvedValue(null);
      mocks.createArtistFromAppleMusic.mockResolvedValue([
        { id: "created-artist-id", name: "New Artist", appleMusicId: "apple-music-artist-id" },
      ]);
      mocks.addFavoriteArtist.mockResolvedValue([
        { ...favoriteRow, artistId: "created-artist-id" },
      ]);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toEqual({ favorite: { ...favoriteRow, artistId: "created-artist-id" } });
      expect(mocks.addFavoriteArtist).toHaveBeenCalledWith(tx, "user-id", "created-artist-id", {
        comment: null,
        emoji: null,
        color: null,
      });
    });

    it("returns a 409 domain error when addFavoriteArtist ignores a duplicate via onConflictDoNothing", async () => {
      mocks.findArtistByAppleMusicId.mockResolvedValue({ id: "artist-id" });
      mocks.addFavoriteArtist.mockResolvedValue([]);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "このアーティストは既にお気に入りに登録されています。",
        statusCode: 409,
        problemSlug: "favorite-artist-already-exists",
      });
    });

    it("returns a 409 DbError when addFavoriteArtist rejects with the primary-key constraint violation", async () => {
      const constraintError = createDrizzleConstraintError({
        constraintName: "favorite_artists_pkey",
        query: 'insert into "favorite_artists"',
      });
      mocks.findArtistByAppleMusicId.mockResolvedValue({ id: "artist-id" });
      mocks.addFavoriteArtist.mockRejectedValue(constraintError);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "このアーティストは既にお気に入りに登録されています。",
        statusCode: 409,
        cause: constraintError,
      });
    });

    it("returns Apple Music failures before opening an RLS transaction", async () => {
      mocks.artistExistsByAppleMusicId.mockResolvedValue(false);
      const error = new DbError({
        message: "指定されたアーティストが見つかりません。",
        statusCode: 404,
      });
      mocks.fetchArtist.mockResolvedValue(error);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "missing-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBe(error);
      expect(mocks.withRls).not.toHaveBeenCalled();
    });

    it("returns the existence-check DB error without opening a transaction", async () => {
      const cause = new Error("connection reset");
      mocks.artistExistsByAppleMusicId.mockRejectedValue(cause);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "アーティストの検索に失敗しました。",
        statusCode: 500,
        cause,
      });
      expect(mocks.withRls).not.toHaveBeenCalled();
    });

    it("detects a soft-delete race between existence check and transaction, retries once, and succeeds", async () => {
      // 事前チェックでは存在確認できたが、tx 内では見つからない（soft-delete レース）
      mocks.artistExistsByAppleMusicId.mockResolvedValue(true);
      mocks.findArtistByAppleMusicId.mockResolvedValue(null);
      mocks.fetchArtist.mockResolvedValue({
        id: "apple-music-artist-id",
        attributes: { name: "Race Artist" },
      });
      mocks.createArtistFromAppleMusic.mockResolvedValue([
        { id: "created-artist-id", name: "Race Artist", appleMusicId: "apple-music-artist-id" },
      ]);
      mocks.addFavoriteArtist.mockResolvedValue([
        { ...favoriteRow, artistId: "created-artist-id" },
      ]);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toEqual({ favorite: { ...favoriteRow, artistId: "created-artist-id" } });
      expect(mocks.withRls).toHaveBeenCalledTimes(2);
      expect(mocks.fetchArtist).toHaveBeenCalledTimes(1);
    });

    it("returns fetchArtist errors from the retry path without a second transaction", async () => {
      mocks.artistExistsByAppleMusicId.mockResolvedValue(true);
      mocks.findArtistByAppleMusicId.mockResolvedValue(null);
      const apiError = new DbError({
        message: "指定されたアーティストが見つかりません。",
        statusCode: 404,
      });
      mocks.fetchArtist.mockResolvedValue(apiError);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBe(apiError);
      expect(mocks.withRls).toHaveBeenCalledTimes(1);
    });

    it("wraps RLS failures as the favorite-artist registration error", async () => {
      const cause = new RlsError({ message: "User not found in database." });
      mocks.withRls.mockResolvedValue(cause);

      const result = await registerFavoriteArtist(
        session,
        {
          appleMusicId: "apple-music-artist-id",
          comment: null,
          emoji: null,
          color: null,
        },
        db,
      );

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入りアーティストの登録に失敗しました。",
        statusCode: 500,
        cause,
      });
    });
  });

  describe("deleteFavoriteArtist", () => {
    it("returns deleted true when the repository removes a favorite", async () => {
      mocks.findArtistByAppleMusicId.mockResolvedValue({ id: "artist-id" });
      mocks.removeFavoriteArtist.mockResolvedValue([{ artistId: "artist-id" }]);

      const result = await deleteFavoriteArtist(session, "apple-music-artist-id", db);

      expect(result).toEqual({ deleted: true });
      expect(mocks.findArtistByAppleMusicId).toHaveBeenCalledWith(tx, "apple-music-artist-id");
      expect(mocks.removeFavoriteArtist).toHaveBeenCalledWith(tx, "user-id", "artist-id");
    });

    it("returns 404 when there is no favorite to remove", async () => {
      mocks.findArtistByAppleMusicId.mockResolvedValue(null);

      const result = await deleteFavoriteArtist(session, "apple-music-artist-id", db);

      expect(result).toBeInstanceOf(DbError);
      expect(result).toMatchObject({
        message: "お気に入りアーティストが見つかりません。",
        statusCode: 404,
      });
    });
  });
});
