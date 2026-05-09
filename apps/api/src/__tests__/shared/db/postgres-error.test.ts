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
 *
 * mapPostgresToDbError:
 * 11. 23505 (unique violation) → DbError(statusCode: 409) を返す
 * 12. 23503 (foreign key violation) → DbError(statusCode: 400) を返す
 * 13. 23502 (not-null violation) → DbError(statusCode: 400) を返す
 * 14. 23514 (check violation) → DbError(statusCode: 400) を返す
 * 15. 認識不能なコード (08001) → null を返す
 * 16. 非 PostgresError (プレーン Error) → null を返す
 * 17. 非 PostgresError (文字列) → null を返す
 * 18. 元のエラーが cause として保持される
 * 19. DrizzleQueryError でラップされた PostgresError を透過的に処理する
 */
import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DbError } from "@repo/errors";
import {
  isPostgresCheckViolation,
  isPostgresForeignKeyViolation,
  isPostgresNotNullViolation,
  isPostgresUniqueViolation,
  mapPostgresToDbError,
  toDbError,
} from "../../../shared/db/postgres-error";
import { createDrizzleConstraintError, createPostgresError } from "../../helpers/postgres-error";

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

describe("mapPostgresToDbError", () => {
  // テスト11: 23505 (unique violation) → DbError(statusCode: 409) を返す
  it("maps unique violation (23505) to DbError with statusCode 409", () => {
    const error = createPostgresError({
      code: "23505",
      constraintName: "favorite_songs_pkey",
      message: "duplicate key value violates unique constraint",
    });

    const result = mapPostgresToDbError(error, "既に登録されています");

    expect(result).not.toBeNull();
    expect(result!).toBeInstanceOf(DbError);
    expect(result!.statusCode).toBe(409);
    expect(result!.message).toBe("既に登録されています");
  });

  // テスト12: 23503 (foreign key violation) → DbError(statusCode: 400) を返す
  it("maps foreign key violation (23503) to DbError with statusCode 400", () => {
    const error = createPostgresError({
      code: "23503",
      constraintName: "favorite_songs_song_id_fkey",
      message: "insert or update on table violates foreign key constraint",
    });

    const result = mapPostgresToDbError(error, "指定された楽曲が見つかりません");

    expect(result).not.toBeNull();
    expect(result!).toBeInstanceOf(DbError);
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toBe("指定された楽曲が見つかりません");
  });

  // テスト13: 23502 (not-null violation) → DbError(statusCode: 400) を返す
  it("maps not-null violation (23502) to DbError with statusCode 400", () => {
    const error = createPostgresError({
      code: "23502",
      constraintName: "songs_title_not_null",
      message: "null value in column violates not-null constraint",
    });

    const result = mapPostgresToDbError(error, "必須項目が入力されていません");

    expect(result).not.toBeNull();
    expect(result!).toBeInstanceOf(DbError);
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toBe("必須項目が入力されていません");
  });

  // テスト14: 23514 (check violation) → DbError(statusCode: 400) を返す
  it("maps check violation (23514) to DbError with statusCode 400", () => {
    const error = createPostgresError({
      code: "23514",
      constraintName: "users_birthyear_check",
      message: "new row for relation violates check constraint",
    });

    const result = mapPostgresToDbError(error, "入力値が不正です");

    expect(result).not.toBeNull();
    expect(result!).toBeInstanceOf(DbError);
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toBe("入力値が不正です");
  });

  // テスト15: 認識不能なコード (08001) → null を返す
  it("returns null for unrecognized PostgresError code", () => {
    const error = createPostgresError({
      code: "08001",
      constraintName: "some_constraint",
      message: "connection failed",
    });

    const result = mapPostgresToDbError(error, "フォールバックメッセージ");

    expect(result).toBeNull();
  });

  // テスト16: 非 PostgresError (プレーン Error) → null を返す
  it("returns null for plain Error", () => {
    const error = new Error("Something went wrong");

    const result = mapPostgresToDbError(error, "フォールバックメッセージ");

    expect(result).toBeNull();
  });

  // テスト17: 非 PostgresError (文字列) → null を返す
  it("returns null for string input", () => {
    const result = mapPostgresToDbError("some error string", "フォールバックメッセージ");

    expect(result).toBeNull();
  });

  // テスト18: 元のエラーが cause として保持される
  it("preserves original error as cause", () => {
    const error = createPostgresError({
      code: "23505",
      constraintName: "favorite_songs_pkey",
      message: "duplicate key value violates unique constraint",
    });

    const result = mapPostgresToDbError(error, "既に登録されています");

    expect(result).not.toBeNull();
    expect(result!.cause).toBe(error);
  });

  // テスト19: DrizzleQueryError でラップされた PostgresError を透過的に処理する
  it("unwraps DrizzleQueryError to map PostgresError code", () => {
    const pgError = createPostgresError({
      code: "23505",
      constraintName: "favorite_songs_pkey",
      message: "duplicate key value violates unique constraint",
    });
    const error = new DrizzleQueryError('insert into "favorite_songs"', [], pgError);

    const result = mapPostgresToDbError(error, "既に登録されています");

    expect(result).not.toBeNull();
    expect(result!).toBeInstanceOf(DbError);
    expect(result!.statusCode).toBe(409);
    expect(result!.cause).toBe(error);
  });
});

describe("toDbError", () => {
  it("maps recognized Postgres errors to DbError instead of falling back to 500", () => {
    const error = createDrizzleConstraintError({
      code: "23503",
      constraintName: "posts_song_id_fkey",
    });

    const result = toDbError(error, "Failed to create post.");

    expect(result).toBeInstanceOf(DbError);
    expect(result).toMatchObject({
      message: "Failed to create post.",
      statusCode: 400,
      cause: error,
    });
  });

  it("uses registered constraint message and typeUri", () => {
    const error = createDrizzleConstraintError({
      code: "23505",
      constraintName: "songs_apple_music_id_key",
    });

    const result = toDbError(error, "Failed to create song.", {
      constraints: ["songs_apple_music_id_key"],
    });

    expect(result).toMatchObject({
      message: "Apple Music ID is already registered for another song.",
      statusCode: 409,
      typeUri: "https://api.otography.com/errors/song-already-exists",
      cause: error,
    });
  });

  it("does not use registry entries unless the constraint is opted in", () => {
    const error = createDrizzleConstraintError({
      code: "23505",
      constraintName: "songs_apple_music_id_key",
    });

    const result = toDbError(error, "Failed to create song.");

    expect(result).toMatchObject({
      message: "Failed to create song.",
      statusCode: 409,
      cause: error,
    });
    expect(result.typeUri).toBeUndefined();
  });

  it("falls back to a 500 DbError for unknown SQLSTATEs", () => {
    const error = createDrizzleConstraintError({
      code: "08001",
      constraintName: "connection_failure",
    });

    const result = toDbError(error, "Failed to fetch songs.");

    expect(result).toMatchObject({
      message: "Failed to fetch songs.",
      statusCode: 500,
      cause: error,
    });
  });

  it("returns existing DbError unchanged", () => {
    const error = new DbError({
      message: "Domain failure.",
      statusCode: 404,
      typeUri: "https://api.otography.com/errors/post-not-found",
    });

    expect(toDbError(error, "Fallback.")).toBe(error);
  });
});
