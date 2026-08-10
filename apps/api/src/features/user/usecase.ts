import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import type { Database } from "../../shared/db";
import { withAnonymousRole, withAuthenticatedRole, withRls } from "../../shared/db/rls";
import { toDbError } from "../../shared/db/postgres-error";
import { domainAuthError } from "../../shared/errors/domain-error";
import { revokeRefreshTokens } from "../../shared/firebase/firebase-admin";
import { revokeAllUserSessions } from "../../shared/auth/session-repository";
import {
  insertUser,
  selectCurrentUser,
  selectUserByUsername,
  setupProfile as setupProfileRepo,
  updateUserDetails,
  softDeleteUser,
} from "./repository";
import { errorLogFields } from "../../shared/logging/log-format";
import { maskIdentifier } from "../../shared/logging/redaction";
import type { InsertUserValues, SetupProfileValues, UpdateUserValues } from "./model";

const USERS_USERNAME_KEY = "users_username_key";
const USERS_BIRTHYEAR_CHECK = "users_birthyear_check";
const USER_NOT_FOUND_IN_DATABASE = "User not found in database.";

const isMissingDatabaseUser = (error: Error) => {
  return (
    (error as Error & { _tag?: string })._tag === "RlsError" &&
    error.message === USER_NOT_FOUND_IN_DATABASE
  );
};

const toAuthDbError = (error: unknown, fallbackMessage: string, code = "db-error") => {
  const dbError = toDbError(error, fallbackMessage);
  return new AuthError({
    message: dbError.message,
    code,
    statusCode: dbError.statusCode,
    problemSlug: dbError.problemSlug,
    cause: dbError,
  });
};

const toProfileDbAuthError = (error: unknown, fallbackMessage: string) => {
  const dbError = toDbError(error, fallbackMessage, {
    constraints: [USERS_USERNAME_KEY, USERS_BIRTHYEAR_CHECK],
  });

  const code = dbError.problemSlug === "username-already-taken" ? "username-taken" : "db-error";

  return new AuthError({
    message: dbError.message,
    code,
    statusCode: dbError.statusCode,
    problemSlug: dbError.problemSlug,
    cause: dbError,
  });
};

// サインアップ時にユーザーレコードを作成
export const createUserRecord = async (values: InsertUserValues, db: Database) => {
  console.info("Creating user record.", { firebaseId: maskIdentifier(values.firebaseId) });

  const result = await withAuthenticatedRole(db, (tx) => insertUser(tx, values)).catch((e) =>
    toAuthDbError(e, "Failed to create user record."),
  );
  if (result instanceof AuthError) {
    console.error("User record creation failed.", errorLogFields(result));
    return result;
  }
  if (result instanceof Error) {
    const error = toAuthDbError(result, "Failed to create user record.");
    console.error("User record creation failed.", errorLogFields(error));
    return error;
  }

  const [user] = result;
  if (!user) {
    console.error("User record creation returned no rows.", {
      firebaseId: maskIdentifier(values.firebaseId),
    });
    return new AuthError({
      message: "Failed to create user record.",
      code: "db-error",
      statusCode: 500,
    });
  }
  console.info("User record creation succeeded.", {
    firebaseId: maskIdentifier(values.firebaseId),
    userId: maskIdentifier(user.id),
    hasProfile: Boolean(user.username && user.name),
  });
  return user;
};

// getProfile の自己修復: DB にユーザーレコードが存在しない場合に作成する
// （サインアップ後の初回アクセスなどで発生する）
const ensureUserRecord = async (session: DecodedIdToken, db: Database) => {
  console.warn("Database user missing during profile fetch; creating it.", {
    firebaseId: maskIdentifier(session.sub),
  });
  const createdUser = await createUserRecord({ firebaseId: session.sub }, db);
  if (createdUser instanceof Error) return createdUser;

  // createUserRecord の .returning() で全カラム取得済みなので、
  // selectCurrentUser（withRls 経由の RLS トランザクション）を再試行せず
  // 直接その結果を使う。RLS トランザクションの失敗による 500 を回避する。
  console.info("Using created user record directly.", {
    firebaseId: maskIdentifier(session.sub),
    userId: maskIdentifier(createdUser.id),
  });
  return [createdUser];
};

// 自分のプロフィールを取得
export const getProfile = async (session: DecodedIdToken, db: Database) => {
  console.info("Fetching current user profile.", { firebaseId: maskIdentifier(session.sub) });

  const initialResult = await withRls(db, session, (tx, userId) => selectCurrentUser(tx, userId));
  if (initialResult instanceof Error && !isMissingDatabaseUser(initialResult)) {
    console.error("Initial profile fetch failed.", errorLogFields(initialResult));
    return toAuthDbError(initialResult, "Failed to fetch user profile.");
  }

  const result =
    initialResult instanceof Error ? await ensureUserRecord(session, db) : initialResult;

  if (result instanceof Error) {
    console.error("Profile fetch failed after self-heal.", errorLogFields(result));
    return toAuthDbError(result, "Failed to fetch user profile.");
  }

  const [user] = result;
  if (!user) {
    console.warn("Profile fetch returned no user row.", {
      firebaseId: maskIdentifier(session.sub),
    });
    return new AuthError({
      message: "User record not found.",
      code: "user-not-found",
      statusCode: 404,
    });
  }

  if (!user.username || !user.name) {
    console.info("Profile is not set up.", {
      firebaseId: maskIdentifier(session.sub),
      userId: maskIdentifier(user.id),
      hasUsername: Boolean(user.username),
      hasName: Boolean(user.name),
    });
    return domainAuthError({
      slug: "profile-not-set-up",
      message: "Profile is not set up.",
      code: "profile-not-set-up",
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

// 初回プロフィール設定（username, name）— UPDATE で既存レコードを更新
export const setupProfile = async (
  session: DecodedIdToken,
  values: SetupProfileValues,
  db: Database,
) => {
  const result = await withRls(db, session, (tx, userId) => setupProfileRepo(tx, userId, values));
  if (result instanceof Error) {
    return toProfileDbAuthError(result, "Failed to create profile.");
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
export const updateProfile = async (
  session: DecodedIdToken,
  values: UpdateUserValues,
  db: Database,
) => {
  const result = await withRls(db, session, (tx, userId) => updateUserDetails(tx, userId, values));
  if (result instanceof Error) {
    return toProfileDbAuthError(result, "Failed to update profile.");
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

// アカウントを論理削除（teardownUserAccount からのみ呼ばれる内部ヘルパー）
const deleteAccount = async (session: DecodedIdToken, db: Database) => {
  const result = await withRls(db, session, (tx, userId) => softDeleteUser(tx, userId));
  if (result instanceof Error) {
    return toAuthDbError(result, "Failed to delete account.");
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

// アカウント削除の認証失効オーケストレーション。
// セッション全失効 → Firebase リフレッシュトークン無効化 → アカウント論理削除の順で実行する。
// 削除より先に全認証情報を失効させることで、途中失敗時に削除済みアカウントへ
// 有効なセッションだけが残る状態を作らない。
export const teardownUserAccount = async (
  session: DecodedIdToken,
  userId: string,
  db: Database,
) => {
  const revokeResult = await revokeAllUserSessions(db, userId);
  if (revokeResult instanceof Error) {
    return new AuthError({
      message: "Failed to revoke active sessions.",
      code: "session-revocation-failed",
      statusCode: 500,
      cause: revokeResult,
    });
  }

  // Firebase 側でもリフレッシュトークンを無効化（アカウント削除境界でのみ実行）
  if (session.sub) {
    const firebaseResult = await revokeRefreshTokens(session.sub);
    if (firebaseResult instanceof Error) {
      return new AuthError({
        message: "Failed to revoke authentication credentials.",
        code: "firebase-token-revocation-failed",
        statusCode: 500,
        cause: firebaseResult,
        clearCookie: true,
      });
    }
  }

  // 認証情報をすべて無効化できた場合にのみアカウントを論理削除する。
  const result = await deleteAccount(session, db);
  if (result instanceof Error) {
    return new AuthError({
      message: result.message,
      code: result.code,
      statusCode: result.statusCode,
      problemSlug: result.problemSlug,
      cause: result,
      clearCookie: true,
    });
  }

  return result;
};

// 公開プロフィールを取得（username で検索）
export const getPublicProfile = async (username: string, db: Database) => {
  const result = await withAnonymousRole(db, (tx) => selectUserByUsername(tx, username)).catch(
    (e) => toAuthDbError(e, "Failed to fetch public profile."),
  );
  if (result instanceof AuthError) return result;
  if (result instanceof Error) {
    return toAuthDbError(result, "Failed to fetch public profile.");
  }

  const [user] = result;
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
      createdAt: user.createdAt,
    },
  };
};
