import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { AuthError } from "@repo/errors/server";
import { signInWithPassword, signUpWithPassword } from "../../shared/firebase-rest";
import {
  createSessionCookie,
  verifyIdToken,
  revokeRefreshTokens,
} from "../../shared/firebase-auth";
import { insertUserWithRls, upsertUserWithRls } from "./repository";
import { normalizeUsername } from "./utils";

const registerAppUser = async (claims: DecodedIdToken, email?: string) => {
  const username = normalizeUsername(email, claims.sub);
  const result = await insertUserWithRls(claims, { firebaseId: claims.sub, username });
  if (result instanceof Error) {
    return new AuthError({
      message: "Failed to create user record.",
      code: "registration-failed",
      statusCode: 500,
      cause: result,
    });
  }
  return result;
};

export const signIn = async (firebaseApiKey: string, email: string, password: string) => {
  const result = await signInWithPassword(firebaseApiKey, email, password);
  if (result instanceof Error) {
    return new AuthError({
      message: result.message,
      code: "sign-in-failed",
      statusCode: result.statusCode,
      cause: result,
    });
  }

  const sessionCookie = await createSessionCookie(result.idToken);
  if (sessionCookie instanceof Error) return sessionCookie;

  return { sessionCookie };
};

export const signUp = async (firebaseApiKey: string, email: string, password: string) => {
  const signUpResult = await signUpWithPassword(firebaseApiKey, email, password);
  if (signUpResult instanceof Error) {
    return new AuthError({
      message: signUpResult.message,
      code: "sign-up-failed",
      statusCode: signUpResult.statusCode,
      cause: signUpResult,
    });
  }

  // ID トークンを検証して DecodedIdToken を取得
  const claims = await verifyIdToken(signUpResult.idToken);
  if (claims instanceof Error) return claims;

  const registerResult = await registerAppUser(claims, signUpResult.email);
  if (registerResult instanceof Error) return registerResult;

  const sessionCookie = await createSessionCookie(signUpResult.idToken);
  if (sessionCookie instanceof Error) return sessionCookie;

  return { sessionCookie };
};

export const getProfile = async (session: DecodedIdToken) => {
  const userId = session.sub;
  if (!userId) {
    return new AuthError({
      message: "The current session is invalid.",
      code: "invalid-session",
      statusCode: 401,
      clearCookie: true,
    });
  }

  const email = session.email ?? null;
  const displayName = session.name ?? null;
  const photoUrl = session.picture ?? null;

  const userResult = await upsertUserWithRls(session, {
    firebaseId: userId,
    username: normalizeUsername(email ?? undefined, userId),
  });
  if (userResult instanceof Error) {
    return new AuthError({
      message: "Failed to fetch user profile.",
      code: "db-error",
      statusCode: 500,
      cause: userResult,
    });
  }

  const [user] = userResult;
  if (!user) {
    return new AuthError({
      message: "Failed to fetch user profile.",
      code: "user-not-found",
      statusCode: 500,
    });
  }

  return {
    profile: {
      id: user.firebaseId,
      email,
      displayName,
      photoUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    userId,
  };
};

export const signOut = async (session: DecodedIdToken | null) => {
  const userId = session?.sub ?? null;

  if (!userId) return { clearSession: true };

  const revokeResult = await revokeRefreshTokens(userId);
  if (revokeResult instanceof Error) {
    // セッションが既に無効な場合はローカルでサインアウト成功とする
    if (revokeResult.clearCookie) return { clearSession: true };
    return revokeResult;
  }

  return { clearSession: true };
};
