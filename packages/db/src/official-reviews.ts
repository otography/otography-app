import { createHash } from "node:crypto";

/** 公式アカウント（/u/otography）の users.id。 */
export const OFFICIAL_USER_ID = "official-otography";

/**
 * 公式アカウントの感想の投稿 ID。data/official-reviews.json の key から作る（同じ key なら同じ ID）。
 * 英小文字と数字の 12 文字で、apps/api/src/lib/id.ts の ID と同じ形。
 */
export function officialPostId(key: string) {
  const digest = createHash("sha256").update(`official-reviews:${key}`).digest();
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(digest.subarray(0, 12), (b) => alphabet[b % alphabet.length]).join("");
}
