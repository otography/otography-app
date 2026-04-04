import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./features/auth";
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

export type Bindings = {
	AUTH_COOKIE_DOMAIN: string | undefined;
	APP_FRONTEND_URL: string;
	DATABASE_URL: string;
	FIREBASE_API_KEY: string;
	FIREBASE_CLIENT_EMAIL: string;
	FIREBASE_PRIVATE_KEY: string;
	FIREBASE_PROJECT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>()
	.use("/api/*", async (c, next) => {
		const middleware = cors({
			origin: c.env.APP_FRONTEND_URL,
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

export default app;

export { app };

// Export for Hono RPC client
export type AppType = typeof app;
