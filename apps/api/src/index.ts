import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { auth } from "./features/auth";
import type { ServerEnv } from "./server-env";
import { authSessionMiddleware } from "./shared/middleware";

const app = new Hono()
	.use("/api/*", async (c, next) => {
		const { APP_FRONTEND_URL } = env<ServerEnv>(c);
		const middleware = cors({
			origin: APP_FRONTEND_URL,
			allowHeaders: ["Content-Type"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			credentials: true,
		});

		return middleware(c, next);
	})
	.use("*", authSessionMiddleware())
	.route("/", auth)
	.get("/", (c) => c.text("Hello Hono!"));

const port = Number(process.env.PORT) || 3001;

export default {
	port,
	fetch: app.fetch,
};

export { app };

// Export for Hono RPC client
export type AppType = typeof app;
