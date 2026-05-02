import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const favoriteSongRow = {
  userId: "user-id",
  songId: "song-id",
  comment: "great",
  emoji: "star",
  color: "#ff0000",
  createdAt: new Date("2026-05-02T00:00:00.000Z"),
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

  it("returns 409 DbError when duplicate favorite rows are ignored by on conflict", async () => {
    const mock = createInsertTx({ rows: [] });

    const result = await addFavoriteSong(mock.tx, "user-id", "song-id", {
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

  it("returns 409 DbError when postgres still reports the primary-key violation", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_songs_pkey",
      query: 'insert into "favorite_songs"',
    });
    const mock = createInsertTx({ error });

    const result = await addFavoriteSong(mock.tx, "user-id", "song-id", {
      comment: null,
      emoji: null,
      color: null,
    });

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "この楽曲は既にお気に入りに登録されています。",
      statusCode: 409,
      cause: error,
    });
  });

  it("returns a generic DbError for unrelated insert failures", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_songs_song_id_songs_id_fkey",
      query: 'insert into "favorite_songs"',
    });
    const mock = createInsertTx({ error });

    const result = await addFavoriteSong(mock.tx, "user-id", "missing-song-id", {
      comment: null,
      emoji: null,
      color: null,
    });

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "お気に入り楽曲の登録に失敗しました。",
      statusCode: 500,
      cause: error,
    });
  });
});
