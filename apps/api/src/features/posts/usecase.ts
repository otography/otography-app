import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import type { Database } from "../../shared/db";
import { toDbError } from "../../shared/db/postgres-error";
import { withAnonymousRole, withRls } from "../../shared/db/rls";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { fetchSong, toSongInput, type SongInput } from "../../shared/apple-music";
import {
  catalogEntityMissingInTx,
  resolveSongInTx,
  withRaceRetry,
} from "../../shared/apple-music-catalog";
import { domainDbError } from "../../shared/errors/domain-error";
import { resolveUserId } from "../../shared/auth/resolve-user-id";
import { songExistsByAppleMusicId } from "../songs/repository";
import {
  createPost,
  findPostByIdWithLikes,
  listPostsWithLikes,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostInsertDbModel, PostUpdateDbModel } from "./model";

export const getPosts = async (
  session: DecodedIdToken | null | undefined,
  pagination: { limit?: number; cursor?: Cursor | null } | undefined,
  db: Database,
) => {
  let userId: string | null = null;
  if (session) {
    const resolved = await resolveUserId(db, session.sub);
    if (typeof resolved !== "string") return resolved;
    userId = resolved;
  }

  const limit = normalizeLimit(pagination?.limit);

  const rows = await withAnonymousRole(db, (tx) =>
    listPostsWithLikes(tx, userId, { limit, cursor: pagination?.cursor }),
  );
  if (rows instanceof Error) {
    return toDbError(rows, "Failed to fetch posts.");
  }

  const paginationMeta = buildPaginationMeta(rows, limit);
  const trimmed = trimItems(rows, limit);

  return { posts: trimmed, pagination: paginationMeta };
};

export const getPost = async (
  id: string,
  session: DecodedIdToken | null | undefined,
  db: Database,
) => {
  let userId: string | null = null;
  if (session) {
    const resolved = await resolveUserId(db, session.sub);
    if (typeof resolved !== "string") return resolved;
    userId = resolved;
  }

  const post = await withAnonymousRole(db, (tx) => findPostByIdWithLikes(tx, id, userId));
  if (post instanceof Error) {
    return toDbError(post, "Failed to fetch post.");
  }
  if (post === null) {
    return domainDbError({
      slug: "post-not-found",
      message: "Post not found.",
    });
  }

  return { post };
};

export const registerPost = async (
  payload: PostCreateDbModel,
  session: DecodedIdToken,
  db: Database,
) => {
  // トランザクション外で曲存在チェック（最適化: 不要なAPI呼び出しを回避）
  const songExists = await songExistsByAppleMusicId(db, payload.appleMusicId).catch((e) =>
    toDbError(e, "Failed to check song existence."),
  );
  if (songExists instanceof Error) return songExists;

  // Apple Music から取得して songInput を組み立てる（初回・リトライで共用）
  const prepareSongInput = async () => {
    const apiResponse = await fetchSong(payload.appleMusicId);
    if (apiResponse instanceof Error) return apiResponse;
    return toSongInput(apiResponse);
  };

  let songInput: SongInput | null = null;
  if (!songExists) {
    const prepared = await prepareSongInput();
    if (prepared instanceof Error) return prepared;
    songInput = prepared;
  }

  const outcome = await withRaceRetry({
    attempt: () =>
      withRls(db, session, async (tx, userId) => {
        const resolved = await resolveSongInTx(tx, payload.appleMusicId, songInput);
        if (resolved === catalogEntityMissingInTx) return catalogEntityMissingInTx;
        if (resolved instanceof Error) return resolved;

        return createPost(tx, {
          songId: resolved.songId,
          userId,
          content: payload.content,
        } satisfies PostInsertDbModel);
      }),
    // createSongFull は onConflictDoUpdate(deletedAt: null) の冪等 upsert なので再実行時は解決する
    recover: async () => {
      const prepared = await prepareSongInput();
      if (prepared instanceof Error) return prepared;
      songInput = prepared;
    },
    fallbackErrorMessage: "Failed to resolve song information.",
  });

  if (!outcome.recovered) return outcome.error;
  const result = outcome.value;

  if (result instanceof Error) {
    if (result instanceof DbError && result.statusCode !== 500) return result;
    return toDbError(result, "Failed to create post.");
  }

  const [post] = result;
  if (!post) {
    return new DbError({ message: "Failed to create post." });
  }

  return { post };
};

type UpdatePostInput = {
  id: string;
  session: DecodedIdToken;
  payload: PostUpdateDbModel;
};

export const modifyPost = async ({ id, session, payload }: UpdatePostInput, db: Database) => {
  const post = await withRls(db, session, (tx) => updatePostById(tx, { id, values: payload }));
  if (post instanceof Error) {
    return toDbError(post, "Failed to update post.");
  }
  if (post === null) {
    return domainDbError({
      slug: "post-not-found",
      message: "Post not found or access denied.",
    });
  }

  return { post };
};

export const removePost = async (id: string, session: DecodedIdToken, db: Database) => {
  const deletedPost = await withRls(db, session, (tx) => softDeletePostById(tx, id));
  if (deletedPost instanceof Error) {
    return toDbError(deletedPost, "Failed to delete post.");
  }
  if (deletedPost === null) {
    return domainDbError({
      slug: "post-not-found",
      message: "Post not found or access denied.",
    });
  }

  return { deleted: true };
};
