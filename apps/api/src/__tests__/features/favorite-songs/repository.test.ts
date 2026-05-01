import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const createInsertTx = (error: unknown) =>
  ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockRejectedValue(error),
      })),
    })),
  }) as never;

describe("favorite songs repository", () => {
  it("returns 409 DbError for duplicate favorite rows", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_songs_pkey",
      query: 'insert into "favorite_songs"',
    });

    const result = await addFavoriteSong(createInsertTx(error), "user-id", "song-id", {
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
