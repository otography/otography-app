import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { appleMusic } from "./features/apple-music";
import { auth } from "./features/auth";
import { artists } from "./features/artists";
import { favoriteArtists } from "./features/favorite-artists";
import { favoriteSongs } from "./features/favorite-songs";
import { health } from "./features/health";
import { songs } from "./features/songs";
import { postLikes } from "./features/post-likes";
import { posts } from "./features/posts";
import { user } from "./features/user";
import { authSessionMiddleware } from "./shared/middleware";
import type { Bindings } from "./shared/types/bindings";

export type { Bindings };

const app = new Hono<{ Bindings: Bindings }>()
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
  // authSessionMiddlewareは認証セッションを解決するミドルウェア
  // health, apple-music等の公開ルートでは不要なため、必要なパスのみに適用
  .use("/api/auth/*", authSessionMiddleware())
  .use("/api/posts/*", authSessionMiddleware())
  .use("/api/user/*", authSessionMiddleware())
  .use("/api/artists/*", authSessionMiddleware())
  .use("/api/songs/*", authSessionMiddleware())
  .use("/api/me/*", authSessionMiddleware())
  .onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ message: "Internal server error." }, 500);
  })
  .route("/", appleMusic)
  .route("/", auth)
  .route("/", artists)
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
