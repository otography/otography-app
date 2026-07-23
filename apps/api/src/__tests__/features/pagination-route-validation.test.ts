import { describe, expect, it } from "vitest";
import { testRequest } from "../helpers/test-client";

describe("一覧エンドポイントのページネーション検証", () => {
  it.each([
    "/api/posts?limit=abc",
    "/api/songs?limit=abc",
    "/api/artists?limit=abc",
    "/api/users/6f648f36-5be1-4af1-bf5d-cf8ebf222221/favorites/songs?limit=abc",
    "/api/users/6f648f36-5be1-4af1-bf5d-cf8ebf222221/favorites/artists?limit=abc",
  ])("%s は不正なlimitを400で拒否する", async (path) => {
    const response = await testRequest(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ status: 400 });
  });
});
