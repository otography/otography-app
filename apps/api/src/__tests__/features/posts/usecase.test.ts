import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { describe, expect, it, vi } from "vitest";
import { DbError, RlsError } from "@repo/errors";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const mocks = vi.hoisted(() => ({
  createPost: vi.fn(),
  createSongFull: vi.fn(),
  fetchSong: vi.fn(),
  findOrCreateArtists: vi.fn(),
  findSongByAppleMusicId: vi.fn(),
  songExistsByAppleMusicId: vi.fn(),
  toSongInput: vi.fn(),
  withRls: vi.fn(),
}));

vi.mock("../../../shared/db/rls", () => ({
  withRls: mocks.withRls,
}));

vi.mock("../../../shared/apple-music", () => ({
  fetchSong: mocks.fetchSong,
  toSongInput: mocks.toSongInput,
}));

vi.mock("../../../features/posts/repository", () => ({
  createPost: mocks.createPost,
}));

vi.mock("../../../features/songs/repository", () => ({
  createSongFull: mocks.createSongFull,
  findSongByAppleMusicId: mocks.findSongByAppleMusicId,
  songExistsByAppleMusicId: mocks.songExistsByAppleMusicId,
}));

vi.mock("../../../features/artists/repository", () => ({
  findOrCreateArtists: mocks.findOrCreateArtists,
}));

import { registerPost } from "../../../features/posts/usecase";

const session = {
  sub: "firebase-user-id",
  uid: "firebase-user-id",
  email: "test@example.com",
} as DecodedIdToken;

const db = { kind: "db" } as never;
const tx = { kind: "transaction" } as never;

const appleMusicId = "am-song-001";
const content = "Great song!";

describe("posts usecase — registerPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withRls.mockImplementation(async (_db, _session, fn) => await fn(tx, "user-id"));
  });

  it("creates a post when the song already exists in DB", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    mocks.findSongByAppleMusicId.mockResolvedValue({
      id: "existing-song-id",
      title: "Song",
      appleMusicId,
    });
    mocks.createPost.mockResolvedValue([
      {
        id: "post-id",
        userId: "user-id",
        songId: "existing-song-id",
        content,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toEqual({
      post: {
        id: "post-id",
        userId: "user-id",
        songId: "existing-song-id",
        content,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    expect(mocks.fetchSong).not.toHaveBeenCalled();
    expect(mocks.findSongByAppleMusicId).toHaveBeenCalledWith(tx, appleMusicId);
    expect(mocks.createPost).toHaveBeenCalledWith(tx, {
      songId: "existing-song-id",
      userId: "user-id",
      content,
    });
  });

  it("fetches from Apple Music, creates song with artists/genres, then creates post", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(false);
    const apiResponse = {
      id: appleMusicId,
      attributes: {
        name: "New Song",
        durationInMillis: 200_000,
        isrc: "JP1234567890",
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
    };
    mocks.fetchSong.mockResolvedValue(apiResponse);
    mocks.toSongInput.mockReturnValue({
      songValues: {
        title: "New Song",
        appleMusicId,
        length: 200,
        isrcs: "JP1234567890",
      },
      genreNames: ["Pop", "Rock"],
      artistEntries: [
        { appleMusicId: "am-artist-001", name: "Artist One" },
        { appleMusicId: "am-artist-002", name: "Artist Two" },
      ],
    });
    mocks.findSongByAppleMusicId.mockResolvedValue(null);
    mocks.findOrCreateArtists.mockResolvedValue(["artist-id-1", "artist-id-2"]);
    mocks.createSongFull.mockResolvedValue({
      id: "new-song-id",
      title: "New Song",
      appleMusicId,
      length: 200,
      isrcs: "JP1234567890",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    });
    mocks.createPost.mockResolvedValue([
      {
        id: "post-id",
        userId: "user-id",
        songId: "new-song-id",
        content,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toEqual({
      post: {
        id: "post-id",
        userId: "user-id",
        songId: "new-song-id",
        content,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    });
    expect(mocks.findOrCreateArtists).toHaveBeenCalledWith(tx, [
      { appleMusicId: "am-artist-001", name: "Artist One" },
      { appleMusicId: "am-artist-002", name: "Artist Two" },
    ]);
    expect(mocks.createSongFull).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        songValues: expect.objectContaining({
          title: "New Song",
          appleMusicId,
          length: 200,
          isrcs: "JP1234567890",
        }),
        artistIds: ["artist-id-1", "artist-id-2"],
        genreNames: ["Pop", "Rock"],
      }),
    );
    expect(mocks.createPost).toHaveBeenCalledWith(tx, {
      songId: "new-song-id",
      userId: "user-id",
      content,
    });
  });

  it("returns Apple Music API errors before opening a transaction", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(false);
    const apiError = new DbError({
      message: "指定された楽曲が見つかりません。",
      statusCode: 404,
    });
    mocks.fetchSong.mockResolvedValue(apiError);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBe(apiError);
    expect(mocks.withRls).not.toHaveBeenCalled();
  });

  it("preserves non-500 DbError from inside the transaction", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    const songError = new DbError({ message: "Failed to resolve artists.", statusCode: 500 });
    mocks.findSongByAppleMusicId.mockResolvedValue(null);
    mocks.findOrCreateArtists.mockResolvedValue(songError);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
  });

  it("wraps RLS failures as DbError", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    const cause = new RlsError({ message: "User not found in database." });
    mocks.withRls.mockResolvedValue(cause);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to create post.",
      statusCode: 500,
      cause,
    });
  });

  it("maps FK violations from the production transaction path to 400", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    const cause = createDrizzleConstraintError({
      code: "23503",
      constraintName: "posts_song_id_fkey",
    });
    mocks.withRls.mockResolvedValue(cause);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to create post.",
      statusCode: 400,
      cause,
    });
  });

  it("maps NOT NULL violations from a DB boundary to 400", async () => {
    const cause = createDrizzleConstraintError({
      code: "23502",
      constraintName: "posts_content_not_null",
    });
    mocks.songExistsByAppleMusicId.mockRejectedValue(cause);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to check song existence.",
      statusCode: 400,
      cause,
    });
  });

  it("maps CHECK violations from the production transaction path to 400", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    const cause = createDrizzleConstraintError({
      code: "23514",
      constraintName: "posts_content_length_check",
    });
    mocks.withRls.mockResolvedValue(cause);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to create post.",
      statusCode: 400,
      cause,
    });
  });

  it("maps generic UNIQUE violations from the production transaction path to 409", async () => {
    mocks.songExistsByAppleMusicId.mockResolvedValue(true);
    const cause = createDrizzleConstraintError({
      code: "23505",
      constraintName: "posts_some_unique_key",
    });
    mocks.withRls.mockResolvedValue(cause);

    const result = await registerPost({ appleMusicId, content }, session, db);

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to create post.",
      statusCode: 409,
      cause,
    });
  });
});
