import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../../env";

declare module "hono" {
	interface ContextVariableMap {
		supabase: SupabaseClient;
	}
}

export const getSupabase = (c: Context) => {
	return c.get("supabase");
};

export const supabaseMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
			cookies: {
				getAll() {
					return parseCookieHeader(c.req.header("Cookie") ?? "") as {
						name: string;
						value: string;
					}[];
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) =>
						setCookie(c, name, value, options as never),
					);
				},
			},
		});

		c.set("supabase", supabase);

		await next();
	};
};
