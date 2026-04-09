import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import type { SetupProfileValues, UpdateUserValues } from "../../shared/db/schema";
import {
  selectUserByFirebaseId,
  selectUserByUsername,
  insertUserProfile,
  updateUserDetails,
  softDeleteUser,
} from "./repository";

// 自分のプロフィールを取得
export const getProfile = async (session: DecodedIdToken) => {
  const result = await selectUserByFirebaseId(session);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to fetch user profile.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [user] = result;
  if (!user) {
    return new AuthError({
      message: "User record not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }

  return {
    profile: {
      username: user.username,
      name: user.name,
      email: session.email ?? null,
      photoUrl: session.picture ?? null,
      bio: user.bio ?? null,
      birthplace: user.birthplace ?? null,
      birthyear: user.birthyear ?? null,
      gender: user.gender ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
};

// 初回プロフィール設定（username, name）— DB レコードを新規作成
export const setupProfile = async (session: DecodedIdToken, values: SetupProfileValues) => {
  const result = await insertUserProfile(session, values);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to create profile.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [user] = result;
  if (!user) {
    return new AuthError({
      message: "Failed to create profile.",
      code: "db-error",
      statusCode: 500,
    });
  }

  return {
    profile: {
      username: user.username,
      name: user.name,
    },
  };
};

// プロフィール詳細を更新（bio, birthplace, birthyear, gender, name）
export const updateProfile = async (session: DecodedIdToken, values: UpdateUserValues) => {
  const result = await updateUserDetails(session, values);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to update profile.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [user] = result;
  if (!user) {
    return new AuthError({
      message: "User record not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }

  return {
    profile: {
      username: user.username,
      name: user.name,
      bio: user.bio,
      birthplace: user.birthplace,
      birthyear: user.birthyear,
      gender: user.gender,
    },
  };
};

// アカウントを論理削除
export const deleteAccount = async (session: DecodedIdToken) => {
  const result = await softDeleteUser(session);
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to delete account.",
      code: "db-error",
      statusCode: 500,
      cause: result,
    });
  }

  const [user] = result;
  if (!user) {
    return new AuthError({
      message: "User record not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }

  return { deleted: true };
};

// 公開プロフィールを取得（username で検索）
export const getPublicProfile = async (username: string) => {
  const [user] = await selectUserByUsername(username);
  if (!user) {
    return new AuthError({
      message: "User not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }

  return {
    profile: {
      username: user.username,
      name: user.name,
      bio: user.bio,
      birthplace: user.birthplace,
      birthyear: user.birthyear,
      gender: user.gender,
      createdAt: user.createdAt,
    },
  };
};
