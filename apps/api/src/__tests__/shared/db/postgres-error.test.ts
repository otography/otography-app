import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  isPostgresCheckViolation,
  isPostgresUniqueViolation,
} from "../../../shared/db/postgres-error";
import { createPostgresError } from "../../helpers/postgres-error";

describe("isPostgresUniqueViolation", () => {
  it("detects unique violations by code property even when String(error) omits the code", () => {
    const error = createPostgresError({
      code: "23505",
      constraintName: "favorite_songs_pkey",
      message: "duplicate key value violates unique constraint",
    });

    expect(String(error)).not.toContain("23505");
    expect(isPostgresUniqueViolation(error, "favorite_songs_pkey")).toBe(true);
  });

  it("unwraps DrizzleQueryError causes", () => {
    const error = new DrizzleQueryError(
      'insert into "favorite_artists"',
      [],
      createPostgresError({ constraintName: "favorite_artists_pkey" }),
    );

    expect(isPostgresUniqueViolation(error, "favorite_artists_pkey")).toBe(true);
  });

  it("unwraps standard Error causes around DrizzleQueryError", () => {
    const error = new Error("Transaction failed.", {
      cause: new DrizzleQueryError(
        'update "users"',
        [],
        createPostgresError({ constraintName: "users_username_key" }),
      ),
    });

    expect(isPostgresUniqueViolation(error, "users_username_key")).toBe(true);
  });

  it("does not treat another unique constraint as a duplicate favorite", () => {
    const error = createPostgresError({ constraintName: "songs_apple_music_id_key" });

    expect(isPostgresUniqueViolation(error, "favorite_songs_pkey")).toBe(false);
  });

  it("does not treat non-unique SQLSTATEs as unique violations", () => {
    const error = createPostgresError({
      code: "23514",
      constraintName: "users_birthyear_check",
    });

    expect(isPostgresUniqueViolation(error, "users_birthyear_check")).toBe(false);
  });
});

describe("isPostgresCheckViolation", () => {
  it("detects check violations by SQLSTATE and constraint name", () => {
    const error = createPostgresError({
      code: "23514",
      constraintName: "users_birthyear_check",
    });

    expect(isPostgresCheckViolation(error, "users_birthyear_check")).toBe(true);
  });

  it("does not treat another check constraint as a birthyear violation", () => {
    const error = createPostgresError({
      code: "23514",
      constraintName: "users_username_min_length",
    });

    expect(isPostgresCheckViolation(error, "users_birthyear_check")).toBe(false);
  });
});
