import { describe, expect, test } from "vite-plus/test";
import type { PostView } from "#/lib/posts";
import { groupPostsByDate } from "./history-groups";

function makePost(id: string, createdAt: string, title: string): PostView {
  return {
    id,
    content: "感想文はサイドバーに表示しない",
    createdAt,
    likeCount: 0,
    likedByMe: false,
    author: {
      publicId: "user-1",
      name: "テストユーザー",
      image: null,
    },
    song: {
      appleSongId: `apple-${id}`,
      isrc: `JP00000000${id}`,
      title,
      artistName: "テストアーティスト",
      albumName: null,
      durationMs: null,
      artworkUrl: null,
      url: null,
    },
  };
}

describe("groupPostsByDate", () => {
  const now = new Date(2026, 10, 21, 15, 0, 0);

  test("今日・昨日・今年・前年以前を日付ごとにまとめる", () => {
    const posts = [
      makePost("1", new Date(2026, 10, 21, 12, 0).toISOString(), "今日の曲A"),
      makePost("2", new Date(2026, 10, 21, 9, 0).toISOString(), "今日の曲B"),
      makePost("3", new Date(2026, 10, 20, 22, 0).toISOString(), "昨日の曲"),
      makePost("4", new Date(2026, 10, 10, 18, 0).toISOString(), "今月の曲"),
      makePost("5", new Date(2025, 4, 3, 10, 0).toISOString(), "去年の曲"),
    ];

    const groups = groupPostsByDate(posts, now);

    expect(
      groups.map((g) => ({ dateKey: g.dateKey, label: g.label, count: g.posts.length })),
    ).toEqual([
      { dateKey: "2026-11-21", label: "今日", count: 2 },
      { dateKey: "2026-11-20", label: "昨日", count: 1 },
      { dateKey: "2026-11-10", label: "11月10日", count: 1 },
      { dateKey: "2025-05-03", label: "2025年5月3日", count: 1 },
    ]);
    expect(groups[0]?.posts.map((p) => p.id)).toEqual(["1", "2"]);
  });

  test("空配列なら空を返す", () => {
    expect(groupPostsByDate([], now)).toEqual([]);
  });

  test("不正な日時は日付不明にまとめる", () => {
    const groups = groupPostsByDate([makePost("x", "invalid-date", "不明な曲")], now);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.dateKey).toBe("unknown");
    expect(groups[0]?.label).toBe("日付不明");
  });
});
