import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { appleMusic } from "./features/apple-music";
import { auth } from "./features/auth";
import { artists } from "./features/artists";
import { errors } from "./features/errors";
import { favoriteArtists } from "./features/favorite-artists";
import { favoriteSongs } from "./features/favorite-songs";
import { health } from "./features/health";
import { songs } from "./features/songs";
import { postLikes } from "./features/post-likes";
import { posts } from "./features/posts";
import { user } from "./features/user";
import { globalErrorHandler } from "./shared/errors/global-error-handler";
import { problemResponse } from "./shared/errors/error-response";
import { authSessionMiddleware, corsMiddleware, dbMiddleware } from "./shared/middleware";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./shared/types/env";

export type { Env };

// authSessionMiddleware を適用する保護対象パスのprefix。
// 新規のprotected featureを追加する場合はこの配列に1行追加するだけでよい。
const PROTECTED_PREFIXES = [
  "/api/auth",
  "/api/apple-music",
  "/api/posts",
  "/api/user",
  "/api/artists",
  "/api/songs",
  "/api/me",
] as const;

const isProtectedPath = (path: string) =>
  PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

// 保護対象パスにのみ authSessionMiddleware を適用するラッパー。
// 公開ルート（health など）は次のミドルウェアへ素通しする。
// 公開サーフェスは public-surface テストの許可リストで管理。
const protectedAuthSession = (): MiddlewareHandler<Env> => {
  const middleware = authSessionMiddleware();
  return async (c, next) => {
    if (!isProtectedPath(c.req.path)) {
      await next();
      return;
    }
    return middleware(c, next);
  };
};

const app = new Hono<Env>()
  .use("/api/*", corsMiddleware)
  .use("*", secureHeaders())
  .use("/api/*", dbMiddleware())
  .use("/api/*", protectedAuthSession())
  .onError(globalErrorHandler)
  .notFound((c) => {
    return problemResponse(c, "not-found", "Not found.");
  })
  .route("/", appleMusic)
  .route("/", auth)
  .route("/", artists)
  .route("/errors", errors)
  .route("/", songs)
  .route("/", posts)
  .route("/", postLikes)
  .route("/", user)
  .route("/", favoriteArtists)
  .route("/", favoriteSongs)
  .route("/api/health", health);

export default app;

export { app };

// Export for Hono RPC client
export type AppType = typeof app;
