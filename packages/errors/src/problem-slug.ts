export type StatusProblemSlug =
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "too-many-requests"
  | "internal-error"
  | "bad-gateway"
  | "service-unavailable";

export type DomainProblemSlug =
  | "email-already-registered"
  | "username-already-taken"
  | "artist-already-exists"
  | "song-already-exists"
  | "favorite-artist-already-exists"
  | "favorite-song-already-exists"
  | "account-conflict"
  | "profile-not-set-up"
  | "post-not-found"
  | "artist-not-found"
  | "song-not-found"
  | "session-expired"
  | "session-revoked"
  | "session-invalid"
  | "account-disabled"
  | "rate-limit-exceeded"
  | "oauth-exchange-failed"
  | "google-token-exchange-failed"
  | "firebase-idp-signin-failed"
  | "auth-service-unavailable";

export type ProblemSlug = StatusProblemSlug | DomainProblemSlug;
