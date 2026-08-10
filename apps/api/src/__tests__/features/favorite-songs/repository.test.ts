import { describe, expect, it, vi } from "vitest";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const favoriteSongRow = {
  userId: "user-id",
  songId: "song-id",
  comment: "great",
  emoji: "star",
  color: "#ff0000",
  createdAt: "2026-05-02T00:00:00.000Z",
};

const createInsertTx = ({ rows, error }: { rows?: unknown[]; error?: unknown }) => {
  const returning = error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(rows);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));

  return {
    tx: { insert } as never,
    insert,
    values,
    onConflictDoNothing,
    returning,
  };
};

describe("favorite songs repository", () => {
  it("inserts a favorite song with idempotent conflict handling and returns the created row", async () => {
    const mock = createInsertTx({ rows: [favoriteSongRow] });

    const result = await addFavoriteSong(mock.tx, "user-id", "song-id", {
      comment: "great",
      emoji: "star",
      color: "#ff0000",
    });

    expect(result).toEqual([favoriteSongRow]);
    expect(mock.values).toHaveBeenCalledWith({
      userId: "user-id",
      songId: "song-id",
      comment: "great",
      emoji: "star",
      color: "#ff0000",
    });
    expect(mock.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("returns an empty array when a duplicate favorite is ignored by onConflictDoNothing", async () => {
    const mock = createInsertTx({ rows: [] });

    const result = await addFavoriteSong(mock.tx, "user-id", "song-id", {
      comment: null,
      emoji: null,
      color: null,
    });

    expect(result).toEqual([]);
  });

  it("propagates the raw error when postgres still reports the primary-key violation (normalization is the usecase's responsibility)", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_songs_pkey",
      query: 'insert into "favorite_songs"',
    });
    const mock = createInsertTx({ error });

    await expect(
      addFavoriteSong(mock.tx, "user-id", "song-id", {
        comment: null,
        emoji: null,
        color: null,
      }),
    ).rejects.toBe(error);
  });

  it("propagates the raw error for unrelated foreign-key insert failures", async () => {
    const error = createDrizzleConstraintError({
      code: "23503",
      constraintName: "favorite_songs_song_id_songs_id_fkey",
      query: 'insert into "favorite_songs"',
    });
    const mock = createInsertTx({ error });

    await expect(
      addFavoriteSong(mock.tx, "user-id", "missing-song-id", {
        comment: null,
        emoji: null,
        color: null,
      }),
    ).rejects.toBe(error);
  });
});
