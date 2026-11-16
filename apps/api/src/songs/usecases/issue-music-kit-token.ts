import type { DeveloperTokenError } from "../../lib/apple-music/errors.ts";
import type { DeveloperToken } from "../../lib/apple-music/token.ts";

/**
 * ブラウザの MusicKit JS（曲の検索と試聴）に渡す開発者トークンを発行する。
 * トークンは origin のページからだけ使える（ADR 0010）。
 */
export function issueMusicKitToken({
  origin,
  getDeveloperToken,
}: {
  origin: string;
  getDeveloperToken: (args: {
    origin: string | null;
  }) => Promise<DeveloperTokenError | DeveloperToken>;
}) {
  return getDeveloperToken({ origin });
}
