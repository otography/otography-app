import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";
import { isPostgresUniqueViolation } from "../../../shared/db/postgres-error";

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

const createPostgresError = (constraintName: string) =>
  new PostgresError({
    message: "duplicate key value violates unique constraint",
    severity_local: "ERROR",
    severity: "ERROR",
    code: "23505",
    position: "",
    file: "",
    line: "",
    routine: "",
    constraint_name: constraintName,
  });

describe("isPostgresUniqueViolation", () => {
  it("detects unique violations by code property even when String(error) omits the code", () => {
    const error = createPostgresError("favorite_songs_pkey");

    expect(String(error)).not.toContain("23505");
    expect(isPostgresUniqueViolation(error, "favorite_songs_pkey")).toBe(true);
  });

  it("unwraps DrizzleQueryError causes", () => {
    const error = new DrizzleQueryError(
      'insert into "favorite_artists"',
      [],
      createPostgresError("favorite_artists_pkey"),
    );

    expect(isPostgresUniqueViolation(error, "favorite_artists_pkey")).toBe(true);
  });

  it("does not treat another unique constraint as a duplicate favorite", () => {
    const error = createPostgresError("songs_apple_music_id_key");

    expect(isPostgresUniqueViolation(error, "favorite_songs_pkey")).toBe(false);
  });
});
