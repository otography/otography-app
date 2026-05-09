/**
 * テストリスト: logError (構造化ログ)
 *
 * Error 入力:
 * 1. Error 入力時に timestamp, path, name, message を含む JSON を console.error に出力する
 * 2. Error に code プロパティがある場合、code も出力に含まれる
 * 3. Error に statusCode プロパティがある場合、statusCode も出力に含まれる
 * 4. タイムスタンプが ISO 8601 形式である
 * 5. 指定された path が正しく出力に含まれる
 *
 * 非 Error 入力:
 * 6. 非 Error (string) 入力でも例外を投げずに JSON を出力する
 * 7. null 入力でも例外を投げずに JSON を出力する
 * 8. undefined 入力でも例外を投げずに JSON を出力する
 */
import { describe, expect, it, vi } from "vitest";
import { logError } from "../../../shared/logging/structured-log";

describe("logError", () => {
  it("Error 入力時に timestamp, path, name, message を含む JSON を console.error に出力する", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Database connection failed");

    logError(error, "/api/auth/sign-in");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("path", "/api/auth/sign-in");
    expect(parsed).toHaveProperty("name", "Error");
    expect(parsed).toHaveProperty("message", "Database connection failed");

    consoleSpy.mockRestore();
  });

  it("Error に code プロパティがある場合、code も出力に含まれる", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Auth failed") as Error & { code: string };
    error.code = "auth/invalid-credentials";

    logError(error, "/api/auth/sign-in");

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("code", "auth/invalid-credentials");

    consoleSpy.mockRestore();
  });

  it("Error に statusCode プロパティがある場合、statusCode も出力に含まれる", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Not found") as Error & { statusCode: number };
    error.statusCode = 404;

    logError(error, "/api/songs/123");

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("statusCode", 404);

    consoleSpy.mockRestore();
  });

  it("タイムスタンプが ISO 8601 形式である", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test");

    logError(error, "/api/test");

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    // ISO 8601 形式のバリデーション: Date としてパース可能で、元の文字列と一致
    const timestamp = parsed.timestamp as string;
    const date = new Date(timestamp);
    expect(date.toISOString()).toBe(timestamp);

    consoleSpy.mockRestore();
  });

  it("指定された path が正しく出力に含まれる", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test");

    logError(error, "/api/auth/sign-in");

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.path).toBe("/api/auth/sign-in");

    consoleSpy.mockRestore();
  });

  it("非 Error (string) 入力でも例外を投げずに JSON を出力する", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => logError("something went wrong", "/api/test")).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("path", "/api/test");
    expect(parsed).toHaveProperty("error", "something went wrong");

    consoleSpy.mockRestore();
  });

  it("null 入力でも例外を投げずに JSON を出力する", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => logError(null, "/api/test")).not.toThrow();

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("error", "null");
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("path", "/api/test");

    consoleSpy.mockRestore();
  });

  it("undefined 入力でも例外を投げずに JSON を出力する", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => logError(undefined, "/api/test")).not.toThrow();

    const output = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("error", "undefined");
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("path", "/api/test");

    consoleSpy.mockRestore();
  });
});
