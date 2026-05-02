import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { and, eq, isNull } from "drizzle-orm";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { users } from "../../shared/db/schema";
import { withAnonymousRls, withRls } from "../../shared/db/rls";
import { countLikesByPostIds, findUserLikesByPostIds } from "../post-likes/repository";
import {
  createPost,
  findActiveSongById,
  findPostById,
  listPosts,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostUpdateDbModel } from "./model";

export const getPosts = async (session?: DecodedIdToken | null) => {
  const rows = await withAnonymousRls((tx) => listPosts(tx));
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to fetch posts.", cause: rows });
  }

  // いいね情報の付与
  const postIds = rows.map((r) => r.id);
  const db = createDb();
  const likeCounts = await countLikesByPostIds(db, postIds);
  const likeCountMap = new Map(likeCounts.map((r) => [r.postId, r.count]));

  let likedPostIds: Set<string> = new Set();
  if (session) {
    const userId = await resolveUserId(session);
    if (typeof userId !== "string") return userId;
    const liked = await findUserLikesByPostIds(db, userId, postIds);
    likedPostIds = new Set(liked);
  }

  const postsWithLikes = rows.map((post) => ({
    ...post,
    likeCount: likeCountMap.get(post.id) ?? 0,
    ...(session !== undefined ? { isLiked: likedPostIds.has(post.id) } : {}),
  }));

  return { posts: postsWithLikes };
};

export const getPost = async (id: string, session?: DecodedIdToken | null) => {
  const post = await withAnonymousRls((tx) => findPostById(tx, id));
  if (post instanceof Error) {
    return new DbError({ message: "Failed to fetch post.", cause: post });
  }
  if (post === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }

  // いいね情報の付与
  const db = createDb();
  const likeCounts = await countLikesByPostIds(db, [id]);
  const likeCount = likeCounts[0]?.count ?? 0;

  let isLiked = false;
  if (session) {
    const userId = await resolveUserId(session);
    if (typeof userId !== "string") return userId;
    const liked = await findUserLikesByPostIds(db, userId, [id]);
    isLiked = liked.length > 0;
  }

  return {
    post: {
      ...post,
      likeCount,
      ...(session !== undefined ? { isLiked } : {}),
    },
  };
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

  const rows = await withRls(session, (tx, userId) => createPost(tx, { ...payload, userId }));
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
  const post = await withRls(session, (tx) => updatePostById(tx, { id, values: payload }));
  if (post instanceof Error) {
    return new DbError({ message: "Failed to update post.", cause: post });
  }
  if (post === null) {
    return new DbError({ message: "Post not found or access denied.", statusCode: 404 });
  }

  return { post };
};

export const removePost = async (id: string, session: DecodedIdToken) => {
  const deletedPost = await withRls(session, (tx) => softDeletePostById(tx, id));
  if (deletedPost instanceof Error) {
    return new DbError({ message: "Failed to delete post.", cause: deletedPost });
  }
  if (deletedPost === null) {
    return new DbError({ message: "Post not found or access denied.", statusCode: 404 });
  }

  return { deleted: true };
};

// Firebase ID → UUID 解決（RLS外で使用）
const resolveUserId = async (session: DecodedIdToken): Promise<string | DbError> => {
  const firebaseId = typeof session.sub === "string" ? session.sub : null;
  if (!firebaseId) {
    return new DbError({ message: "Missing user identifier in session." });
  }

  const db = createDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.firebaseId, firebaseId), isNull(users.deletedAt)))
    .limit(1)
    .catch((e) => new DbError({ message: "Failed to resolve user ID.", cause: e }));

  if (rows instanceof Error) return rows;
  if (!rows[0]) {
    return new DbError({ message: "User not found in database." });
  }

  return rows[0].id;
};
