import type {
  DomainProblemSlug,
  ErrorStatusCode,
  ProblemSlug,
  StatusProblemSlug,
} from "@repo/errors";

/**
 * ドメイン固有エラー型の定義
 */
type ErrorTypeDefinition = {
  /** kebab-case のエラー識別子（例: artist-already-exists） */
  slug: DomainProblemSlug;
  /** RFC 9457 type URI（例: https://api.otography.com/errors/artist-already-exists） */
  typeUri: string;
  /** ヒューマンリーダブルなタイトル */
  title: string;
  /** エラーの説明と対処法 */
  description: string;
  /** 推奨 HTTP ステータスコード */
  statusCode: ErrorStatusCode;
};

type StatusTypeDefinition = {
  slug: StatusProblemSlug;
  typeUri: string;
  title: string;
  description: string;
  statusCode: ErrorStatusCode;
};

type ConstraintDefinition = {
  constraintName: string;
  message: string;
  statusCode?: ErrorStatusCode;
  errorSlug?: ErrorSlug;
};

/**
 * 汎用 Problem Details 型のレジストリ。
 * domain 固有の説明文を持たない、HTTP ステータスに紐づく標準的なエラー型を扱う。
 */
export const STATUS_ERROR_TYPES = [
  {
    slug: "bad-request",
    typeUri: "https://api.otography.com/errors/bad-request",
    title: "Bad Request",
    description: "リクエストの形式または内容が不正です。入力内容を確認してください。",
    statusCode: 400 as ErrorStatusCode,
  },
  {
    slug: "unauthorized",
    typeUri: "https://api.otography.com/errors/unauthorized",
    title: "Unauthorized",
    description: "認証が必要です。ログインしてから再試行してください。",
    statusCode: 401 as ErrorStatusCode,
  },
  {
    slug: "forbidden",
    typeUri: "https://api.otography.com/errors/forbidden",
    title: "Forbidden",
    description: "この操作を実行する権限がありません。",
    statusCode: 403 as ErrorStatusCode,
  },
  {
    slug: "not-found",
    typeUri: "https://api.otography.com/errors/not-found",
    title: "Not Found",
    description: "指定されたリソースが見つかりません。",
    statusCode: 404 as ErrorStatusCode,
  },
  {
    slug: "conflict",
    typeUri: "https://api.otography.com/errors/conflict",
    title: "Conflict",
    description: "現在のリソース状態と競合するため、リクエストを完了できません。",
    statusCode: 409 as ErrorStatusCode,
  },
  {
    slug: "too-many-requests",
    typeUri: "https://api.otography.com/errors/too-many-requests",
    title: "Too Many Requests",
    description: "リクエスト数が制限を超えました。しばらく待ってから再試行してください。",
    statusCode: 429 as ErrorStatusCode,
  },
  {
    slug: "internal-error",
    typeUri: "https://api.otography.com/errors/internal-error",
    title: "Internal Server Error",
    description: "サーバー内部でエラーが発生しました。しばらく待ってから再試行してください。",
    statusCode: 500 as ErrorStatusCode,
  },
  {
    slug: "bad-gateway",
    typeUri: "https://api.otography.com/errors/bad-gateway",
    title: "Bad Gateway",
    description: "外部サービスとの通信に失敗しました。しばらく待ってから再試行してください。",
    statusCode: 502 as ErrorStatusCode,
  },
  {
    slug: "service-unavailable",
    typeUri: "https://api.otography.com/errors/service-unavailable",
    title: "Service Unavailable",
    description: "サービスが一時的に利用できません。しばらく待ってから再試行してください。",
    statusCode: 503 as ErrorStatusCode,
  },
] as const satisfies readonly StatusTypeDefinition[];

/**
 * 全ドメイン固有エラー型のレジストリ。
 * 汎用型（bad-request, internal-error, not-found 等）は STATUS_ERROR_TYPES で扱う。
 */
export const ERROR_TYPES = [
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
] as const satisfies readonly ErrorTypeDefinition[];

export type ErrorSlug = DomainProblemSlug;

export const POSTGRES_CONSTRAINTS = [
  {
    constraintName: "artists_apple_music_id_key",
    message: "Apple Music ID is already registered for another artist.",
    errorSlug: "artist-already-exists",
  },
  {
    constraintName: "songs_apple_music_id_key",
    message: "Apple Music ID is already registered for another song.",
    errorSlug: "song-already-exists",
  },
  {
    constraintName: "favorite_artists_pkey",
    message: "このアーティストは既にお気に入りに登録されています。",
    errorSlug: "favorite-artist-already-exists",
  },
  {
    constraintName: "favorite_songs_pkey",
    message: "この楽曲は既にお気に入りに登録されています。",
    errorSlug: "favorite-song-already-exists",
  },
  {
    constraintName: "users_username_key",
    message: "Username is already taken.",
    errorSlug: "username-already-taken",
  },
  {
    constraintName: "users_birthyear_check",
    message: "Invalid birthyear.",
  },
] as const satisfies readonly ConstraintDefinition[];

export type PostgresConstraintName = (typeof POSTGRES_CONSTRAINTS)[number]["constraintName"];

/**
 * slug からエントリを検索するインデックス
 */
const slugIndex = new Map<string, ErrorTypeDefinition>(
  ERROR_TYPES.map((entry) => [entry.slug, entry]),
);

const statusSlugIndex = new Map<string, StatusTypeDefinition>(
  STATUS_ERROR_TYPES.map((entry) => [entry.slug, entry]),
);

const constraintIndex = new Map<string, ConstraintDefinition>(
  POSTGRES_CONSTRAINTS.map((entry) => [entry.constraintName, entry]),
);

/**
 * slug でエントリを取得する
 */
export const getBySlug = (slug: string): ErrorTypeDefinition | undefined => {
  return slugIndex.get(slug);
};

export const getProblemType = (slug: ProblemSlug): ErrorTypeDefinition | StatusTypeDefinition => {
  return slugIndex.get(slug) ?? statusSlugIndex.get(slug)!;
};

export const findProblemType = (
  slug: string,
): ErrorTypeDefinition | StatusTypeDefinition | undefined => {
  return slugIndex.get(slug) ?? statusSlugIndex.get(slug);
};

/**
 * 全 slug の配列を返す
 */
export const getAllSlugs = (): ErrorSlug[] => {
  return ERROR_TYPES.map((entry) => entry.slug);
};

export const getProblemTypeUri = (slug: ProblemSlug): string => {
  return getProblemType(slug).typeUri;
};

export const getPostgresConstraint = (
  constraintName: PostgresConstraintName,
): ConstraintDefinition => {
  return constraintIndex.get(constraintName)!;
};

export const findPostgresConstraint = (
  constraintName: string,
): ConstraintDefinition | undefined => {
  return constraintIndex.get(constraintName);
};
