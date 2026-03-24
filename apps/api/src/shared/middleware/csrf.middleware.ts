import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import { getEnv } from "../../env";

export const csrfProtection = (): MiddlewareHandler => {
	return async (c, next) => {
		const env = getEnv(c);
		const middleware = csrf({
			origin: (origin) => {
				return origin === env.APP_FRONTEND_URL;
			},
		});

		return middleware(c, next);
	};
};
