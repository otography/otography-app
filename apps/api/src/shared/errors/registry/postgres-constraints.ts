import type { ErrorStatusCode } from "@repo/errors";
import type { ErrorSlug } from "./domain-error-types";

export type ConstraintDefinition = {
  constraintName: string;
  message: string;
  statusCode?: ErrorStatusCode;
  errorSlug?: ErrorSlug;
};

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
