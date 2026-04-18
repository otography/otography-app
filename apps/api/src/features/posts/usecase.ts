import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import { generateEmbedding } from "./lib/embedding";
import {
  insertPost,
  selectPostById,
  selectSongById,
  selectUserIdByFirebaseId,
  softDeletePost,
  updatePostContent,
  updatePostEmbedding,
} from "./repository";

// 投稿を作成（embedding生成付き）
export const createPost = async (
  session: DecodedIdToken,
  values: { content: string; songId: string },
  ai: Ai,
) => {
  // ユーザーのDB UUIDを取得
  const userRows = await selectUserIdByFirebaseId(session.uid);
  if (!userRows.length) {
    return new AuthError({
      message: "User not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }
  const userId = userRows[0]!.id;

  // songIdの存在確認
  const songRows = await selectSongById(values.songId);
  if (!songRows.length) {
    return new AuthError({
      message: "Song not found.",
      code: "song-not-found",
      statusCode: 404,
    });
  }

  // 投稿を作成
  const result = await insertPost(session, { ...values, userId });
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to create post.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [post] = result;
  if (!post) {
    return new AuthError({
      message: "Failed to create post.",
      code: "db-error",
      statusCode: 500,
    });
  }

  // Embedding生成（ベストエフォート — 失敗しても投稿は返却）
  const embedding = await generateEmbedding(values.content, ai);
  if (embedding instanceof Error) {
    console.warn("Embedding generation failed:", embedding.message);
  } else if (embedding !== null) {
    const updateResult = await updatePostEmbedding(session, post.id, embedding);
    if (updateResult instanceof Error) {
      console.warn("Failed to save embedding:", updateResult.message);
    }
  }

  return {
    post: {
      id: post.id,
      content: post.content,
      songId: post.songId,
      userId: post.userId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
  };
};

// 投稿を取得
export const getPost = async (postId: string) => {
  const rows = await selectPostById(postId);
  if (!rows.length) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  const post = rows[0]!;
  return {
    post: {
      id: post.id,
      content: post.content,
      songId: post.songId,
      userId: post.userId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    },
  };
};

// 投稿を更新
export const updatePost = async (session: DecodedIdToken, postId: string, content: string) => {
  // 投稿の存在確認と所有者チェック
  const rows = await selectPostById(postId);
  if (!rows.length) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  const post = rows[0]!;
  // 所有者確認: post.userId はユーザーのDB UUID、session.uid は Firebase UID
  // firebaseIdからDB UUIDを取得して比較
  const userRows = await selectUserIdByFirebaseId(session.uid);
  if (!userRows.length || userRows[0]!.id !== post.userId) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  const result = await updatePostContent(session, postId, content);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to update post.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [updatedPost] = result;
  if (!updatedPost) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  return {
    post: {
      id: updatedPost.id,
      content: updatedPost.content,
      songId: updatedPost.songId,
      userId: updatedPost.userId,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
    },
  };
};

// 投稿を論理削除
export const deletePost = async (session: DecodedIdToken, postId: string) => {
  // 投稿の存在確認と所有者チェック
  const rows = await selectPostById(postId);
  if (!rows.length) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  const post = rows[0]!;
  const userRows = await selectUserIdByFirebaseId(session.uid);
  if (!userRows.length || userRows[0]!.id !== post.userId) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  const result = await softDeletePost(session, postId);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to delete post.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [deletedPost] = result;
  if (!deletedPost) {
    return new AuthError({
      message: "Post not found.",
      code: "post-not-found",
      statusCode: 404,
    });
  }

  return { deleted: true };
};
