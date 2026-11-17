import { DrizzleQueryError } from "drizzle-orm";
import * as errore from "errore";
import { describe, expect, test } from "vite-plus/test";
import { redactError } from "../../src/lib/log.ts";

class PostInsertError extends errore.createTaggedError({
  name: "PostInsertError",
  message: "投稿を保存できませんでした",
}) {}

describe("redactError", () => {
  test("DrizzleQueryError の値を、文言とスタックトレースから取り除き、SQL は残す", () => {
    const query = "insert into post_ip_logs (post_id, ip_address) values (?, ?)";
    const queryError = new DrizzleQueryError(
      query,
      ["p1", "203.0.113.1"],
      new Error("SQLITE_BUSY"),
    );
    const error = new PostInsertError({ cause: queryError });

    const logged = JSON.stringify(redactError(error));
    expect(logged).not.toContain("203.0.113.1");
    expect(logged).toContain(query);
    expect(logged).toContain("投稿を保存できませんでした");
    expect(logged).toContain("SQLITE_BUSY");
  });

  test("循環した cause でも止まる", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    expect(() => JSON.stringify(redactError(a))).not.toThrow();
  });
});
