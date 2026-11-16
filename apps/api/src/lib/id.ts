import { generateRandomString } from "better-auth/crypto";

/**
 * URL に出す ID（users.public_id、posts.id）を作る。英小文字と数字の 12 文字で、CSPRNG から作る。
 * 理由は docs/adr/0004-random-permanent-public-id.md を参照。
 */
export const createPublicId = () => generateRandomString(12, "a-z", "0-9");
