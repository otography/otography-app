import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import { withAnonymousRls, withRls } from "../../shared/db/rls";
import {
  createPost,
  findActiveSongById,
  findPostById,
  listPosts,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostUpdateDbModel } from "./model";

export const getPosts = async () => {
  const rows = await withAnonymousRls((tx) => listPosts(tx));
  if (rows instanceof Error) {
    return new DbError({ message: "Failed to fetch posts.", cause: rows });
  }

  return { posts: rows };
};

export const getPost = async (id: string) => {
  const post = await withAnonymousRls((tx) => findPostById(tx, id));
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
