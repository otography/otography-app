import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import { env } from "../env";

export const csrfProtection = (): MiddlewareHandler => {
	return csrf({
		origin: (origin) => {
			return origin === env.APP_FRONTEND_URL;
		},
	});
};
