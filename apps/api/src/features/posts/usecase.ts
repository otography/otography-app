import { DbError } from "@repo/errors";
import { createDb } from "../../shared/db";
import {
  createPost,
  findActiveSongById,
  findActiveUserByFirebaseId,
  findPostById,
  listPosts,
  softDeletePostById,
  updatePostById,
} from "./repository";
import type { PostCreateDbModel, PostUpdateDbModel } from "./model";

export const getPosts = async () => {
  const db = createDb();
  const rows = await listPosts(db).catch(
    (e) => new DbError({ message: "Failed to fetch posts.", cause: e }),
  );
  if (rows instanceof Error) return rows;

  return { posts: rows };
};

export const getPost = async (id: string) => {
  const db = createDb();
  const post = await findPostById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch post.", cause: e }),
  );
  if (post instanceof Error) return post;
  if (post === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }

  return { post };
};

export const registerPost = async (payload: PostCreateDbModel, firebaseId: string) => {
  const db = createDb();

  const user = await findActiveUserByFirebaseId(db, firebaseId).catch(
    (e) => new DbError({ message: "Failed to fetch user.", cause: e }),
  );
  if (user instanceof Error) return user;
  if (user === null) {
    return new DbError({ message: "User not found.", statusCode: 404 });
  }

  const song = await findActiveSongById(db, payload.songId).catch(
    (e) => new DbError({ message: "Failed to fetch song.", cause: e }),
  );
  if (song instanceof Error) return song;
  if (song === null) {
    return new DbError({ message: "Song not found.", statusCode: 404 });
  }

  const rows = await createPost(db, { ...payload, userId: user.id }).catch(
    (e) => new DbError({ message: "Failed to create post.", cause: e }),
  );
  if (rows instanceof Error) return rows;

  const [post] = rows;
  if (!post) {
    return new DbError({ message: "Failed to create post." });
  }

  return { post };
};

type UpdatePostInput = {
  id: string;
  firebaseId: string;
  payload: PostUpdateDbModel;
};

export const modifyPost = async ({ id, firebaseId, payload }: UpdatePostInput) => {
  const db = createDb();

  const user = await findActiveUserByFirebaseId(db, firebaseId).catch(
    (e) => new DbError({ message: "Failed to fetch user.", cause: e }),
  );
  if (user instanceof Error) return user;
  if (user === null) {
    return new DbError({ message: "User not found.", statusCode: 404 });
  }

  if (payload.songId !== undefined) {
    const song = await findActiveSongById(db, payload.songId).catch(
      (e) => new DbError({ message: "Failed to fetch song.", cause: e }),
    );
    if (song instanceof Error) return song;
    if (song === null) {
      return new DbError({ message: "Song not found.", statusCode: 404 });
    }
  }

  const existingPost = await findPostById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch post.", cause: e }),
  );
  if (existingPost instanceof Error) return existingPost;
  if (existingPost === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }
  if (existingPost.userId !== user.id) {
    return new DbError({ message: "You are not allowed to modify this post.", statusCode: 403 });
  }

  const post = await updatePostById(db, { id, userId: user.id, values: payload }).catch(
    (e) => new DbError({ message: "Failed to update post.", cause: e }),
  );
  if (post instanceof Error) return post;
  if (post === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }

  return { post };
};

export const removePost = async (id: string, firebaseId: string) => {
  const db = createDb();

  const user = await findActiveUserByFirebaseId(db, firebaseId).catch(
    (e) => new DbError({ message: "Failed to fetch user.", cause: e }),
  );
  if (user instanceof Error) return user;
  if (user === null) {
    return new DbError({ message: "User not found.", statusCode: 404 });
  }

  const existingPost = await findPostById(db, id).catch(
    (e) => new DbError({ message: "Failed to fetch post.", cause: e }),
  );
  if (existingPost instanceof Error) return existingPost;
  if (existingPost === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }
  if (existingPost.userId !== user.id) {
    return new DbError({ message: "You are not allowed to delete this post.", statusCode: 403 });
  }

  const deletedPost = await softDeletePostById(db, { id, userId: user.id }).catch(
    (e) => new DbError({ message: "Failed to delete post.", cause: e }),
  );
  if (deletedPost instanceof Error) return deletedPost;
  if (deletedPost === null) {
    return new DbError({ message: "Post not found.", statusCode: 404 });
  }

  return { deleted: true };
};
