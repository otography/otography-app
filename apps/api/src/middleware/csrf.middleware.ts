import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import { env } from "hono/adapter";

type CsrfEnv = {
	APP_FRONTEND_URL?: string;
};

export const csrfProtection = (): MiddlewareHandler => {
	return csrf({
		origin: (origin, c) => {
			const { APP_FRONTEND_URL } = env<CsrfEnv>(c);
			if (!APP_FRONTEND_URL) return false;
			return origin === APP_FRONTEND_URL;
		},
	});
};
