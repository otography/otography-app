import type { PostView } from "#/lib/posts";

export type PostDateGroup = {
  dateKey: string;
  label: string;
  posts: PostView[];
};

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date, now: Date) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / 86_400_000);

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function groupPostsByDate(posts: readonly PostView[], now = new Date()): PostDateGroup[] {
  const groups: PostDateGroup[] = [];
  const byKey = new Map<string, PostDateGroup>();

  for (const post of posts) {
    const parsed = new Date(post.createdAt);
    const valid = !Number.isNaN(parsed.getTime());
    const dateKey = valid ? toLocalDateKey(parsed) : "unknown";
    let group = byKey.get(dateKey);

    if (!group) {
      group = {
        dateKey,
        label: valid ? formatDateLabel(parsed, now) : "日付不明",
        posts: [],
      };
      byKey.set(dateKey, group);
      groups.push(group);
    }
    group.posts.push(post);
  }

  return groups;
}
