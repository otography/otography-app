import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import type { DatabaseOrTransaction, Database } from "../../shared/db";
import { toDbError } from "../../shared/db/postgres-error";
import { withAnonymousRole, withRls } from "../../shared/db/rls";
import type { Cursor } from "../../shared/pagination";
import { buildPaginationMeta, normalizeLimit, trimItems } from "../../shared/pagination";
import { fetchSong, toSongInput } from "../../shared/apple-music";
import { domainDbError } from "../../shared/errors/domain-error";
import { findOrCreateArtists } from "../artists/repository";
import {
  createSongFull,
  findSongByAppleMusicId,
  songExistsByAppleMusicId,
} from "../songs/repository";
import {
  createPost,
  findPostByIdWithLikes,
  listPostsWithLikes,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostInsertDbModel, PostUpdateDbModel } from "./model";

// Firebase ID → UUID 解決
const resolveUserId = async (
  db: DatabaseOrTransaction,
  firebaseId: string,
): Promise<string | DbError> => {
  const rows = await db
    .execute<{ resolve_firebase_id: string | null }>(sql`select resolve_firebase_id(${firebaseId})`)
    .catch((e) => toDbError(e, "Failed to resolve user ID."));

  if (rows instanceof Error) return rows;
  const userId = rows[0]?.resolve_firebase_id;
  if (!userId) {
    return new DbError({ message: "User not found in database." });
  }

  return userId;
};

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

  let songInput: Awaited<ReturnType<typeof toSongInput>> | null = null;
  if (!songExists) {
    const apiResponse = await fetchSong(payload.appleMusicId);
    if (apiResponse instanceof Error) return apiResponse;
    songInput = toSongInput(apiResponse);
    if (songInput instanceof Error) return songInput;
  }

  // トランザクション内: 曲 find-or-create + 投稿作成
  const result = await withRls(db, session, async (tx, userId) => {
    let songId: string;

    const found = await findSongByAppleMusicId(tx, payload.appleMusicId);
    if (found) {
      songId = found.id;
    } else {
      if (!songInput) {
        return new DbError({ message: "Failed to resolve song information." });
      }
      const artistIds = await findOrCreateArtists(tx, songInput.artistEntries).catch((e) =>
        toDbError(e, "Failed to resolve artists."),
      );
      if (artistIds instanceof Error) return artistIds;

      const song = await createSongFull(tx, {
        songValues: songInput.songValues,
        artistIds,
        genreNames: songInput.genreNames,
      });
      if (!song) {
        return new DbError({ message: "Failed to create song." });
      }
      songId = song.id;
    }

    return createPost(tx, { songId, userId, content: payload.content } satisfies PostInsertDbModel);
  });

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
