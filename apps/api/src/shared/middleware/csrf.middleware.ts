import type { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { csrf } from "hono/csrf";
import type { ServerEnv } from "../../server-env";

export const csrfProtection = (): MiddlewareHandler => {
	return async (c, next) => {
		const { APP_FRONTEND_URL } = env<ServerEnv>(c);
		const middleware = csrf({
			origin: (origin) => {
				return origin === APP_FRONTEND_URL;
			},
		});

		return middleware(c, next);
	};
};
