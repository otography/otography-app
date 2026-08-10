import { AuthError } from "@repo/errors/server";
import type { Database } from "../../../shared/db";
import { signInWithPassword, signUpWithPassword } from "../../../shared/firebase/firebase-rest";
import { maskIdentifier } from "../../../shared/logging/redaction";
import { domainAuthError } from "../../../shared/errors/domain-error";
import { issueSessionForFirebaseUser } from "./session-issuance";

type EmailCredentialsParams = {
  apiKey: string;
  email: string;
  password: string;
  db: Database;
};

type EmailSignInResult = {
  opaqueId: string;
  firebaseId: string;
};

// email/passwordサインイン: Firebase認証 → ユーザーレコード作成 → セッション発行
export const signInWithEmail = async ({
  apiKey,
  email,
  password,
  db,
}: EmailCredentialsParams): Promise<EmailSignInResult | AuthError> => {
  console.info("Email sign-in started.", { emailDomain: email.split("@")[1] ?? "[unknown]" });

  const result = await signInWithPassword(apiKey, email, password);
  if (result instanceof Error) {
    console.warn("Email sign-in failed before session creation.", {
      statusCode: result.statusCode,
      message: result.message,
    });
    return new AuthError({
      message: result.message,
      code: "sign-in-failed",
      statusCode: result.statusCode,
      cause: result,
    });
  }
  console.info("Email sign-in authenticated with Firebase.", {
    firebaseId: maskIdentifier(result.localId),
  });

  const issued = await issueSessionForFirebaseUser({
    firebaseId: result.localId,
    firebaseIdToken: result.idToken,
    firebaseRefreshToken: result.refreshToken,
    db,
  });
  if (issued instanceof Error) return issued;

  return { opaqueId: issued.opaqueId, firebaseId: result.localId };
};

// email/passwordサインアップ: Firebaseアカウント作成 → ユーザーレコード作成 → セッション発行
export const signUpWithEmail = async ({
  apiKey,
  email,
  password,
  db,
}: EmailCredentialsParams): Promise<EmailSignInResult | AuthError> => {
  console.info("Email sign-up started.", { emailDomain: email.split("@")[1] ?? "[unknown]" });

  const signUpResult = await signUpWithPassword(apiKey, email, password);
  if (signUpResult instanceof Error) {
    console.warn("Email sign-up failed before session creation.", {
      statusCode: signUpResult.statusCode,
      message: signUpResult.message,
    });
    const error =
      signUpResult.statusCode === 409
        ? domainAuthError({
            slug: "email-already-registered",
            message: signUpResult.message,
            code: "sign-up-failed",
            cause: signUpResult,
          })
        : new AuthError({
            message: signUpResult.message,
            code: "sign-up-failed",
            statusCode: signUpResult.statusCode,
            cause: signUpResult,
          });
    return error;
  }
  console.info("Email sign-up created Firebase account.", {
    firebaseId: maskIdentifier(signUpResult.localId),
  });

  const issued = await issueSessionForFirebaseUser({
    firebaseId: signUpResult.localId,
    firebaseIdToken: signUpResult.idToken,
    firebaseRefreshToken: signUpResult.refreshToken,
    db,
  });
  if (issued instanceof Error) return issued;

  return { opaqueId: issued.opaqueId, firebaseId: signUpResult.localId };
};
