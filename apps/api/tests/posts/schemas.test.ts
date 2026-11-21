import { POST_CONTENT_MAX } from "db";
import { describe, expect, test } from "vite-plus/test";
import { createPostInput } from "../../src/posts/schemas.ts";

const valid = { songId: "1679278167", isrc: "jpp302300157", content: "  好きな曲  " };
const parseContent = (content: string) => createPostInput.safeParse({ ...valid, content }).success;

describe("createPostInput", () => {
  test("本文の前後の空白を除き、ISRC を大文字にする", () => {
    expect(createPostInput.parse(valid)).toEqual({
      songId: "1679278167",
      isrc: "JPP302300157",
      content: "好きな曲",
    });
  });

  test("本文は空白だけでは投稿できない", () => {
    expect(createPostInput.safeParse({ ...valid, content: "   " }).success).toBe(false);
  });

  test("本文の上限はコードポイントで数える（DB の CHECK 制約の length() と同じ数え方）", () => {
    expect(parseContent("あ".repeat(POST_CONTENT_MAX))).toBe(true);
    expect(parseContent("あ".repeat(POST_CONTENT_MAX + 1))).toBe(false);
    expect(parseContent("😀".repeat(POST_CONTENT_MAX))).toBe(true);
    expect(parseContent("😀".repeat(POST_CONTENT_MAX + 1))).toBe(false);
  });

  test("ISRC は 12 文字、曲の ID と本文は必須", () => {
    expect(createPostInput.safeParse({ ...valid, isrc: "JPP30230015" }).success).toBe(false);
    expect(createPostInput.safeParse({ isrc: valid.isrc, content: valid.content }).success).toBe(
      false,
    );
    expect(createPostInput.safeParse({ songId: valid.songId, isrc: valid.isrc }).success).toBe(
      false,
    );
  });
});
