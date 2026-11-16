import type { z } from "zod";
import type { SessionUser } from "../../auth/session.ts";
import type { CatalogSong } from "../../lib/apple-music/catalog.ts";
import type { Database } from "../../lib/db.ts";
import { createPublicId } from "../../lib/id.ts";
import { getOrCreateSong } from "../../songs/repository.ts";
import { MissingIpAddressError, PostOutputError } from "../errors.ts";
import { insertPostWithIpLog } from "../repository.ts";
import { type createPostInput, postOutput } from "../schemas.ts";

/**
 * 曲を選んで投稿する。
 * 曲が未保存なら Apple Music から取得して保存し、投稿と投稿時の IP アドレスを保存する。
 */
export async function createPost<FetchError extends Error>({
  db,
  fetchSong,
  user,
  ipAddress,
  input,
}: {
  db: Database;
  fetchSong: (songId: string) => Promise<FetchError | CatalogSong>;
  user: SessionUser;
  ipAddress: string | null;
  input: z.output<typeof createPostInput>;
}) {
  // 発信者情報開示請求に備えて IP を必ず残す（設計ドキュメント）。IP がなければ投稿を保存しない。
  if (!ipAddress) return new MissingIpAddressError();

  const song = await getOrCreateSong({ db, songId: input.songId, isrc: input.isrc, fetchSong });
  if (song instanceof Error) return song;

  const post = await insertPostWithIpLog({
    db,
    post: { id: createPublicId(), userId: user.id, songIsrc: song.isrc, content: input.content },
    ipAddress,
  });
  if (post instanceof Error) return post;

  const output = postOutput.safeParse({ ...post, song });
  if (!output.success) return new PostOutputError({ postId: post.id, cause: output.error });
  return output.data;
}
