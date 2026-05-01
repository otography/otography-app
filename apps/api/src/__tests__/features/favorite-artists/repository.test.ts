import { describe, expect, it, vi } from "vitest";
import { DbError } from "@repo/errors";
import { addFavoriteArtist } from "../../../features/favorite-artists/repository";
import { createDrizzleConstraintError } from "../../helpers/postgres-error";

const createInsertTx = (error: unknown) =>
  ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockRejectedValue(error),
      })),
    })),
  }) as never;

describe("favorite artists repository", () => {
  it("returns 409 DbError for duplicate favorite rows", async () => {
    const error = createDrizzleConstraintError({
      constraintName: "favorite_artists_pkey",
      query: 'insert into "favorite_artists"',
    });

    const result = await addFavoriteArtist(createInsertTx(error), "user-id", "artist-id", {
      comment: null,
      emoji: null,
      color: null,
    });

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "このアーティストは既にお気に入りに登録されています。",
      statusCode: 409,
    });
  });
});
