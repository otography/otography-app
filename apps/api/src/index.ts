import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./features/auth";
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
  .use("*", authSessionMiddleware())
  .onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ message: "Internal server error." }, 500);
  })
  .route("/", auth)
  .route("/", user)
  .get("/", (c) => c.text("Hello Hono!"));

export default app;

export { app };

// Export for Hono RPC client
export type AppType = typeof app;
