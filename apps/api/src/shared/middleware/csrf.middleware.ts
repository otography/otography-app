import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";

export const csrfProtection = (): MiddlewareHandler => {
	return async (c, next) => {
		const middleware = csrf({
			origin: (origin) => {
				return origin === c.env.APP_FRONTEND_URL;
			},
		});

		return middleware(c, next);
	};
};
