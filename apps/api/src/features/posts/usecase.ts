import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { withAnonymousRole, withRls } from "../../shared/db/rls";
import { findActiveSongById } from "../songs/repository";
import {
  createPost,
  findPostByIdWithLikes,
  listPostsWithLikes,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostUpdateDbModel } from "./model";

// Firebase ID → UUID 解決
const resolveUserId = async (session: DecodedIdToken): Promise<string | DbError> => {
  const firebaseId = typeof session.sub === "string" ? session.sub : null;
  if (!firebaseId) {
    return new DbError({ message: "Missing user identifier in session." });
  }

  const db = createDb();
  const rows = await db
    .execute<{ resolve_firebase_id: string | null }>(sql`select resolve_firebase_id(${firebaseId})`)
    .catch((e) => new DbError({ message: "Failed to resolve user ID.", cause: e }));

  if (rows instanceof Error) return rows;
  const userId = rows[0]?.resolve_firebase_id;
  if (!userId) {
    return new DbError({ message: "User not found in database." });
  }

  return userId;
};

export const getPosts = async (session?: DecodedIdToken | null) => {
  // セッションがある場合は先にuserIdを解決
  let userId: string | null = null;
  if (session) {
    const resolved = await resolveUserId(session);
    if (typeof resolved !== "string") return resolved;
    userId = resolved;
  }

  // 投稿取得 + いいね情報を1クエリで取得
  const db = createDb();
  const rows = await withAnonymousRole(db, (tx) => listPostsWithLikes(tx, userId));
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to fetch posts.", cause: rows });
  }

  return { posts: rows };
};

export const getPost = async (id: string, session?: DecodedIdToken | null) => {
  // セッションがある場合は先にuserIdを解決
  let userId: string | null = null;
  if (session) {
    const resolved = await resolveUserId(session);
    if (typeof resolved !== "string") return resolved;
    userId = resolved;
  }

  // 投稿取得 + いいね情報を1クエリで取得
  const db = createDb();
  const post = await withAnonymousRole(db, (tx) => findPostByIdWithLikes(tx, id, userId));
  if (post instanceof Error) {
    return new DbError({ message: "Failed to fetch post.", cause: post });
  }
  if (post === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }

  return { post };
};

export const registerPost = async (payload: PostCreateDbModel, session: DecodedIdToken) => {
  const db = createDb();

  const song = await findActiveSongById(db, payload.songId).catch(
    (e) => new DbError({ message: "Failed to fetch song.", cause: e }),
  );
  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  const rows = await withRls(db, session, (tx, userId) => createPost(tx, { ...payload, userId }));
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to create post.", cause: rows });
  }

  const [post] = rows;
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

export const modifyPost = async ({ id, session, payload }: UpdatePostInput) => {
  const db = createDb();
  const post = await withRls(db, session, (tx) => updatePostById(tx, { id, values: payload }));
  if (post instanceof Error) {
    return new DbError({ message: "Failed to update post.", cause: post });
  }
  if (post === null) {
    return new DbError({ message: "Post not found or access denied.", statusCode: 404 });
  }

  return { post };
};

export const removePost = async (id: string, session: DecodedIdToken) => {
  const db = createDb();
  const deletedPost = await withRls(db, session, (tx) => softDeletePostById(tx, id));
  if (deletedPost instanceof Error) {
    return new DbError({ message: "Failed to delete post.", cause: deletedPost });
  }
  if (deletedPost === null) {
    return new DbError({ message: "Post not found or access denied.", statusCode: 404 });
  }

  return { deleted: true };
};
