import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ProblemSlug } from "./problem-slug";
import * as errore from "errore";

class OAuthConfigError extends errore.createTaggedError({
  name: "OAuthConfigError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 500;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

class OAuthStateError extends errore.createTaggedError({
  name: "OAuthStateError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 400;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

class OAuthExchangeError extends errore.createTaggedError({
  name: "OAuthExchangeError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

// Google OAuth トークン交換失敗（oauth2.googleapis.com/token）
class GoogleTokenExchangeError extends errore.createTaggedError({
  name: "GoogleTokenExchangeError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

// Firebase signInWithIdp 失敗
class FirebaseIdpSigninError extends errore.createTaggedError({
  name: "FirebaseIdpSigninError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 502;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

// 同一メールアドレスが別プロバイダーで既に登録済み（needConfirmation）
class AccountConflictError extends errore.createTaggedError({
  name: "AccountConflictError",
  message: "$message",
}) {
  statusCode: ContentfulStatusCode = 409;
  readonly problemSlug?: ProblemSlug;

  constructor(args: { message: string; problemSlug?: ProblemSlug; cause?: unknown }) {
    super(args);
    this.problemSlug = args.problemSlug;
  }
}

export {
  AccountConflictError,
  FirebaseIdpSigninError,
  GoogleTokenExchangeError,
  OAuthConfigError,
  OAuthExchangeError,
  OAuthStateError,
};
