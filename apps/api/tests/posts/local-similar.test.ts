import { describe, expect, test } from "vite-plus/test";
import { isLocalDatabaseUrl, simulateLocalSimilarPosts } from "../../src/posts/local-similar.ts";
import { postViewOutput } from "../../src/posts/schemas.ts";

describe("isLocalDatabaseUrl", () => {
  test("ローカル DB の URL だけを true にする", () => {
    expect(isLocalDatabaseUrl("http://127.0.0.1:8080")).toBe(true);
    expect(isLocalDatabaseUrl("http://localhost:8080")).toBe(true);
    expect(isLocalDatabaseUrl("file:local.db")).toBe(true);

    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("libsql://otography-prod.turso.io")).toBe(false);
    expect(isLocalDatabaseUrl("https://otography-staging.turso.io")).toBe(false);
  });
});

describe("simulateLocalSimilarPosts", () => {
  test("曲付きのダミー投稿を 3 件返し、応答のスキーマに一致する", async () => {
    const posts = await simulateLocalSimilarPosts({ delayMs: 0 });
    expect(posts).toHaveLength(3);
    for (const post of posts) {
      expect(post.song).not.toBeNull();
      expect(post.song?.artworkUrl).toBeTruthy();
      expect(post.song?.url).toBeTruthy();
      expect(postViewOutput.safeParse(post).success).toBe(true);
    }
  });
});
