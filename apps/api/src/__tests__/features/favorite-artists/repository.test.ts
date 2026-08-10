import { describe, expect, it, vi } from "vitest";
import { addFavoriteArtist } from "../../../features/favorite-artists/repository";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const favoriteArtistRow = {
  userId: "user-id",
  artistId: "artist-id",
  comment: "最高!",
  emoji: "🎸",
  color: "#0000ff",
  createdAt: "2026-05-02T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z",
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

describe("favorite artists repository", () => {
  it("inserts a favorite artist with idempotent conflict handling and returns the created row", async () => {
    const mock = createInsertTx({ rows: [favoriteArtistRow] });

    const result = await addFavoriteArtist(mock.tx, "user-id", "artist-id", {
      comment: "最高!",
      emoji: "🎸",
      color: "#0000ff",
    });

    expect(result).toEqual([favoriteArtistRow]);
    expect(mock.values).toHaveBeenCalledWith({
      userId: "user-id",
      artistId: "artist-id",
      comment: "最高!",
      emoji: "🎸",
      color: "#0000ff",
    });
    expect(mock.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("returns an empty array when a duplicate favorite is ignored by onConflictDoNothing", async () => {
    const mock = createInsertTx({ rows: [] });

    const result = await addFavoriteArtist(mock.tx, "user-id", "artist-id", {
      comment: null,
      emoji: null,
      color: null,
    });

    expect(result).toEqual([]);
  });

  it("propagates the raw error when postgres rejects the insert (normalization is the usecase's responsibility)", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_artists_pkey",
      query: 'insert into "favorite_artists"',
    });
    const mock = createInsertTx({ error });

    await expect(
      addFavoriteArtist(mock.tx, "user-id", "artist-id", {
        comment: null,
        emoji: null,
        color: null,
      }),
    ).rejects.toBe(error);
  });
});
