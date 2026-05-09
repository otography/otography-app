import type { ErrorStatusCode } from "@repo/errors";

/**
 * ドメイン固有エラー型の定義
 */
type ErrorTypeDefinition = {
  /** kebab-case のエラー識別子（例: artist-already-exists） */
  slug: string;
  /** RFC 7807 type URI（例: https://api.otography.com/errors/artist-already-exists） */
  typeUri: string;
  /** ヒューマンリーダブルなタイトル */
  title: string;
  /** エラーの説明と対処法 */
  description: string;
  /** 推奨 HTTP ステータスコード */
  statusCode: ErrorStatusCode;
};

/**
 * 全ドメイン固有エラー型のレジストリ。
 * 汎用型（bad-request, internal-error, not-found 等）は STATUS_MAPPING に残す。
 */
export const ERROR_TYPES: readonly ErrorTypeDefinition[] = [
  // 409 Conflict
  {
    slug: "email-already-registered",
    typeUri: "https://api.otography.com/errors/email-already-registered",
    title: "Email Already Registered",
    description:
      "指定されたメールアドレスは既に登録されています。別のメールアドレスを使用するか、ログインしてください。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "username-already-taken",
    typeUri: "https://api.otography.com/errors/username-already-taken",
    title: "Username Already Taken",
    description: "指定されたユーザー名は既に使用されています。別のユーザー名を選択してください。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "artist-already-exists",
    typeUri: "https://api.otography.com/errors/artist-already-exists",
    title: "Artist Already Exists",
    description: "指定されたアーティストは既に登録されています。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "song-already-exists",
    typeUri: "https://api.otography.com/errors/song-already-exists",
    title: "Song Already Exists",
    description: "指定された楽曲は既に登録されています。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "favorite-artist-already-exists",
    typeUri: "https://api.otography.com/errors/favorite-artist-already-exists",
    title: "Favorite Artist Already Exists",
    description: "指定されたアーティストは既にお気に入りに追加されています。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "favorite-song-already-exists",
    typeUri: "https://api.otography.com/errors/favorite-song-already-exists",
    title: "Favorite Song Already Exists",
    description: "指定された楽曲は既にお気に入りに追加されています。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "account-conflict",
    typeUri: "https://api.otography.com/errors/account-conflict",
    title: "Account Conflict",
    description:
      "OAuth プロバイダーのアカウントと既存のアカウントが競合しています。既存のアカウントでログインしてプロバイダーを連携してください。",
    statusCode: 409 as ErrorStatusCode,
  },
  // 404 Not Found
  {
    slug: "profile-not-set-up",
    typeUri: "https://api.otography.com/errors/profile-not-set-up",
    title: "Profile Not Set Up",
    description:
      "アカウントは認証済みですが、プロフィールが未設定です。ユーザー名と表示名を設定してください。",
    statusCode: 404 as ErrorStatusCode,
  },
  {
    slug: "post-not-found",
    typeUri: "https://api.otography.com/errors/post-not-found",
    title: "Post Not Found",
    description:
      "指定された投稿が見つかりません。投稿が削除されたか、アクセス権限がない可能性があります。",
    statusCode: 404 as ErrorStatusCode,
  },
  {
    slug: "artist-not-found",
    typeUri: "https://api.otography.com/errors/artist-not-found",
    title: "Artist Not Found",
    description: "指定されたアーティストが見つかりません。",
    statusCode: 404 as ErrorStatusCode,
  },
  {
    slug: "song-not-found",
    typeUri: "https://api.otography.com/errors/song-not-found",
    title: "Song Not Found",
    description: "指定された楽曲が見つかりません。",
    statusCode: 404 as ErrorStatusCode,
  },
  // 401 Unauthorized
  {
    slug: "session-expired",
    typeUri: "https://api.otography.com/errors/session-expired",
    title: "Session Expired",
    description: "セッションの有効期限が切れました。再度ログインしてください。",
    statusCode: 401 as ErrorStatusCode,
  },
  {
    slug: "session-revoked",
    typeUri: "https://api.otography.com/errors/session-revoked",
    title: "Session Revoked",
    description: "セッションが取り消されました。再度ログインしてください。",
    statusCode: 401 as ErrorStatusCode,
  },
  {
    slug: "session-invalid",
    typeUri: "https://api.otography.com/errors/session-invalid",
    title: "Session Invalid",
    description: "セッションが無効です。再度ログインしてください。",
    statusCode: 401 as ErrorStatusCode,
  },
  // 403 Forbidden
  {
    slug: "account-disabled",
    typeUri: "https://api.otography.com/errors/account-disabled",
    title: "Account Disabled",
    description: "このアカウントは無効化されています。サポートにお問い合わせください。",
    statusCode: 403 as ErrorStatusCode,
  },
  // 429 Too Many Requests
  {
    slug: "rate-limit-exceeded",
    typeUri: "https://api.otography.com/errors/rate-limit-exceeded",
    title: "Rate Limit Exceeded",
    description: "リクエスト数が制限を超えました。しばらく待ってから再試行してください。",
    statusCode: 429 as ErrorStatusCode,
  },
  // 502 Bad Gateway
  {
    slug: "oauth-exchange-failed",
    typeUri: "https://api.otography.com/errors/oauth-exchange-failed",
    title: "OAuth Exchange Failed",
    description: "OAuth 認証サーバーとの通信に失敗しました。しばらく待ってから再試行してください。",
    statusCode: 502 as ErrorStatusCode,
  },
  {
    slug: "google-token-exchange-failed",
    typeUri: "https://api.otography.com/errors/google-token-exchange-failed",
    title: "Google Token Exchange Failed",
    description: "Google とのトークン交換に失敗しました。しばらく待ってから再試行してください。",
    statusCode: 502 as ErrorStatusCode,
  },
  {
    slug: "firebase-idp-signin-failed",
    typeUri: "https://api.otography.com/errors/firebase-idp-signin-failed",
    title: "Firebase IDP Sign-In Failed",
    description:
      "Firebase Identity Provider へのサインインに失敗しました。しばらく待ってから再試行してください。",
    statusCode: 502 as ErrorStatusCode,
  },
  // 503 Service Unavailable
  {
    slug: "auth-service-unavailable",
    typeUri: "https://api.otography.com/errors/auth-service-unavailable",
    title: "Auth Service Unavailable",
    description: "認証サービスが一時的に利用できません。しばらく待ってから再試行してください。",
    statusCode: 503 as ErrorStatusCode,
  },
] as const;

/**
 * slug からエントリを検索するインデックス
 */
const slugIndex = new Map<string, ErrorTypeDefinition>(
  ERROR_TYPES.map((entry) => [entry.slug, entry]),
);

/**
 * slug でエントリを取得する
 */
export const getBySlug = (slug: string): ErrorTypeDefinition | undefined => {
  return slugIndex.get(slug);
};

/**
 * 全 slug の配列を返す
 */
export const getAllSlugs = (): string[] => {
  return ERROR_TYPES.map((entry) => entry.slug);
};

/**
 * slug から typeUri 文字列を取得する。
 * 未知の slug の場合は undefined を返す。
 */
export const getTypeUri = (slug: string): string | undefined => {
  return slugIndex.get(slug)?.typeUri;
};
