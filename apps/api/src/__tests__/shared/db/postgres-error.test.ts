/**
 * テストリスト: isPostgresForeignKeyViolation, isPostgresNotNullViolation
 *
 * isPostgresForeignKeyViolation:
 * 1. コード 23503 の PostgresError を true と判定する
 * 2. 異なるコード (23505) の PostgresError に対して false を返す
 * 3. 非 PostgresError (プレーン Error) に対して false を返す
 * 4. DrizzleQueryError でラップされた 23503 エラーを透過的に検出する
 * 5. Error でラップされた DrizzleQueryError 内の 23503 エラーを透過的に検出する
 *
 * isPostgresNotNullViolation:
 * 6. コード 23502 の PostgresError を true と判定する
 * 7. 異なるコード (23503) の PostgresError に対して false を返す
 * 8. 非 PostgresError (プレーン Error) に対して false を返す
 * 9. DrizzleQueryError でラップされた 23502 エラーを透過的に検出する
 * 10. Error でラップされた DrizzleQueryError 内の 23502 エラーを透過的に検出する
 */
import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  isPostgresCheckViolation,
  isPostgresForeignKeyViolation,
  isPostgresNotNullViolation,
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

describe("isPostgresForeignKeyViolation", () => {
  // テスト1: コード 23503 の PostgresError を true と判定する
  it("detects foreign key violations by code 23503", () => {
    const error = createPostgresError({
      code: "23503",
      constraintName: "favorite_songs_song_id_fkey",
      message: "insert or update on table violates foreign key constraint",
    });

    expect(isPostgresForeignKeyViolation(error)).toBe(true);
  });

  // テスト2: 異なるコード (23505) の PostgresError に対して false を返す
  it("returns false for non-matching error code", () => {
    const error = createPostgresError({
      code: "23505",
      constraintName: "favorite_songs_song_id_fkey",
    });

    expect(isPostgresForeignKeyViolation(error)).toBe(false);
  });

  // テスト3: 非 PostgresError (プレーン Error) に対して false を返す
  it("returns false for non-PostgresError", () => {
    const error = new Error("Something went wrong");

    expect(isPostgresForeignKeyViolation(error)).toBe(false);
  });

  // テスト4: DrizzleQueryError でラップされた 23503 エラーを透過的に検出する
  it("unwraps DrizzleQueryError to detect FK violation", () => {
    const error = new DrizzleQueryError(
      'insert into "favorite_songs"',
      [],
      createPostgresError({
        code: "23503",
        constraintName: "favorite_songs_song_id_fkey",
      }),
    );

    expect(isPostgresForeignKeyViolation(error)).toBe(true);
  });

  // テスト5: Error でラップされた DrizzleQueryError 内の 23503 エラーを透過的に検出する
  it("unwraps standard Error around DrizzleQueryError to detect FK violation", () => {
    const error = new Error("Transaction failed.", {
      cause: new DrizzleQueryError(
        'insert into "favorite_songs"',
        [],
        createPostgresError({
          code: "23503",
          constraintName: "favorite_songs_song_id_fkey",
        }),
      ),
    });

    expect(isPostgresForeignKeyViolation(error)).toBe(true);
  });
});

describe("isPostgresNotNullViolation", () => {
  // テスト6: コード 23502 の PostgresError を true と判定する
  it("detects not-null violations by code 23502", () => {
    const error = createPostgresError({
      code: "23502",
      constraintName: "songs_title_not_null",
      message: "null value in column violates not-null constraint",
    });

    expect(isPostgresNotNullViolation(error)).toBe(true);
  });

  // テスト7: 異なるコード (23503) の PostgresError に対して false を返す
  it("returns false for non-matching error code", () => {
    const error = createPostgresError({
      code: "23503",
      constraintName: "songs_title_not_null",
    });

    expect(isPostgresNotNullViolation(error)).toBe(false);
  });

  // テスト8: 非 PostgresError (プレーン Error) に対して false を返す
  it("returns false for non-PostgresError", () => {
    const error = new Error("Something went wrong");

    expect(isPostgresNotNullViolation(error)).toBe(false);
  });

  // テスト9: DrizzleQueryError でラップされた 23502 エラーを透過的に検出する
  it("unwraps DrizzleQueryError to detect NOT NULL violation", () => {
    const error = new DrizzleQueryError(
      'insert into "songs"',
      [],
      createPostgresError({
        code: "23502",
        constraintName: "songs_title_not_null",
      }),
    );

    expect(isPostgresNotNullViolation(error)).toBe(true);
  });

  // テスト10: Error でラップされた DrizzleQueryError 内の 23502 エラーを透過的に検出する
  it("unwraps standard Error around DrizzleQueryError to detect NOT NULL violation", () => {
    const error = new Error("Transaction failed.", {
      cause: new DrizzleQueryError(
        'insert into "songs"',
        [],
        createPostgresError({
          code: "23502",
          constraintName: "songs_title_not_null",
        }),
      ),
    });

    expect(isPostgresNotNullViolation(error)).toBe(true);
  });
});
