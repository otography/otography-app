import { Hono } from "hono";
import { cors } from "hono/cors";
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
import { authSessionMiddleware, dbMiddleware } from "./shared/middleware";
import type { Env } from "./shared/types/env";

export type { Env };

const app = new Hono<Env>()
  .use("/api/*", async (c, next) => {
    const middleware = cors({
      origin: c.env.APP_FRONTEND_URL,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    });

    return middleware(c, next);
  })
  .use("*", secureHeaders())
  .use("/api/*", dbMiddleware())
  // authSessionMiddlewareは認証セッションを解決するミドルウェア
  // 公開ルートは health ごとに個別対応。公開サーフェスは public-surface テストの許可リストで管理。
  .use("/api/auth/*", authSessionMiddleware())
  .use("/api/apple-music/*", authSessionMiddleware())
  .use("/api/posts/*", authSessionMiddleware())
  .use("/api/user/*", authSessionMiddleware())
  .use("/api/artists/*", authSessionMiddleware())
  .use("/api/songs/*", authSessionMiddleware())
  .use("/api/me/*", authSessionMiddleware())
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
