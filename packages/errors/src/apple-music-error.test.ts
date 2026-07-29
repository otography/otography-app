import { describe, expect, it } from "vitest";

import { AppleMusicError } from "./apple-music-error";

describe("AppleMusicError", () => {
  it("name が AppleMusicError", () => {
    const error = new AppleMusicError({ message: "test" });
    expect(error.name).toBe("AppleMusicError");
  });

  it("message を透過する", () => {
    const error = new AppleMusicError({ message: "Apple Music API のリクエストに失敗しました。" });
    expect(error.message).toBe("Apple Music API のリクエストに失敗しました。");
  });

  it("デフォルト statusCode は 502", () => {
    const error = new AppleMusicError({ message: "test" });
    expect(error.statusCode).toBe(502);
  });

  it("明示的な statusCode と cause を保持する", () => {
    const cause = new Error("underlying");
    const error = new AppleMusicError({
      message: "not found",
      statusCode: 404,
      cause,
    });
    expect(error.statusCode).toBe(404);
    expect(error.cause).toBe(cause);
  });

  it("problemSlug を保持する", () => {
    const error = new AppleMusicError({
      message: "test",
      problemSlug: "bad-gateway",
    });
    expect(error.problemSlug).toBe("bad-gateway");
  });

  it("instanceof Error である", () => {
    const error = new AppleMusicError({ message: "test" });
    expect(error).toBeInstanceOf(Error);
  });
});
