import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { auth } from "./features/auth";
import type { ServerEnv } from "./server-env";
import { authSessionMiddleware } from "./shared/middleware";
import { AuthError } from "@repo/errors/server";
import {
	AuthRestError,
	RlsError,
	OAuthConfigError,
	OAuthStateError,
	OAuthExchangeError,
} from "@repo/errors";
import { clearSessionCookie } from "./shared/session";

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
	.onError((err, c) => {
		// AuthError は clearCookie 処理が必要
		if (err instanceof AuthError) {
			if (err.clearCookie) clearSessionCookie(c);
			return c.json({ message: err.message }, err.statusCode);
		}

		// ドメインエラー（AuthRestError, RlsError, OAuth*Error）は statusCode を持つ
		if (
			err instanceof AuthRestError ||
			err instanceof RlsError ||
			err instanceof OAuthConfigError ||
			err instanceof OAuthStateError ||
			err instanceof OAuthExchangeError
		) {
			return c.json({ message: err.message }, err.statusCode);
		}

		// 未知のエラーは 500
		console.error("Unhandled error:", err);
		return c.json({ message: "Internal server error." }, 500);
	})
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
