import { describe, expect, it } from "vitest";
import { testRequest } from "./helpers/test-client";

describe("GET /", () => {
  it("旧ルートは削除され404を返す", async () => {
    const res = await testRequest("/");

    expect(res.status).toBe(404);
  });
});
