import { describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DbError } from "@repo/errors";
import postgres from "postgres";
import { addFavoriteSong } from "../../../features/favorite-songs/repository";

type PostgresErrorPayload = {
  message: string;
  severity_local: string;
  severity: string;
  code: string;
  position: string;
  file: string;
  line: string;
  routine: string;
  constraint_name: string;
};

const PostgresError = postgres.PostgresError as unknown as new (
  payload: PostgresErrorPayload,
) => postgres.PostgresError;

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
    const postgresError = new PostgresError({
      message: "duplicate key value violates unique constraint",
      severity_local: "ERROR",
      severity: "ERROR",
      code: "23505",
      position: "",
      file: "",
      line: "",
      routine: "",
      constraint_name: "favorite_songs_pkey",
    });
    const error = new DrizzleQueryError('insert into "favorite_songs"', [], postgresError);

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
