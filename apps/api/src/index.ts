import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./features/auth";
import { getBootEnv, getEnv } from "./env";
import { authSessionMiddleware } from "./shared/middleware";

const app = new Hono()
	.use("/api/*", async (c, next) => {
		const env = getEnv(c);
		const middleware = cors({
			origin: env.APP_FRONTEND_URL,
			allowHeaders: ["Content-Type"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			credentials: true,
		});

		return middleware(c, next);
	})
	.use("*", authSessionMiddleware())
	.route("/", auth)
	.get("/", (c) => c.text("Hello Hono!"));

const port = getBootEnv().PORT;

export default {
	port,
	fetch: app.fetch,
};

// Export for Hono RPC client
export type AppType = typeof app;
