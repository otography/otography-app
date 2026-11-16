import { FAVORITE_LIMIT, USER_NAME_MAX } from "db";
import { describe, expect, test } from "vite-plus/test";
import { replaceFavoriteSongsInput, updateProfileInput } from "../../src/users/schemas.ts";

const item = { songId: "1679278167", isrc: "JPP302300157" };
const parseItem = (extra: Record<string, unknown>) =>
  replaceFavoriteSongsInput.safeParse({ items: [{ ...item, ...extra }] }).success;

describe("updateProfileInput", () => {
  test("表示名の前後の空白を除き、空の自己紹介は NULL にする", () => {
    expect(updateProfileInput.parse({ name: "  名前  ", bio: "   " })).toEqual({
      name: "名前",
      bio: null,
    });
  });

  test("表示名は空にできず、上限を超えられない", () => {
    expect(updateProfileInput.safeParse({ name: "  " }).success).toBe(false);
    expect(updateProfileInput.safeParse({ name: "あ".repeat(USER_NAME_MAX + 1) }).success).toBe(
      false,
    );
  });
});

describe("replaceFavoriteSongsInput", () => {
  test("絵文字は見た目で 1 文字の絵文字を 1 つだけ受け付ける", () => {
    expect(parseItem({ emoji: "😀" })).toBe(true);
    expect(parseItem({ emoji: "👍🏽" })).toBe(true);
    expect(parseItem({ emoji: "👨‍👩‍👧" })).toBe(true);
    expect(parseItem({ emoji: "🇯🇵" })).toBe(true);
    expect(parseItem({ emoji: "😀😀" })).toBe(false);
    expect(parseItem({ emoji: "a" })).toBe(false);
  });

  test("色は候補の中から選び、コメントは 100 文字まで", () => {
    expect(parseItem({ color: "blue" })).toBe(true);
    expect(parseItem({ color: "black" })).toBe(false);
    expect(parseItem({ comment: "あ".repeat(100) })).toBe(true);
    expect(parseItem({ comment: "あ".repeat(101) })).toBe(false);
  });

  test("お気に入りは上限の件数まで", () => {
    const items = (n: number) => Array.from({ length: n }, () => item);
    expect(replaceFavoriteSongsInput.safeParse({ items: items(FAVORITE_LIMIT) }).success).toBe(
      true,
    );
    expect(replaceFavoriteSongsInput.safeParse({ items: items(FAVORITE_LIMIT + 1) }).success).toBe(
      false,
    );
  });
});
