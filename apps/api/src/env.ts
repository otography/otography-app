import { createEnv } from "@t3-oss/env-core";
import { type } from "arktype";
import type { Context } from "hono";
import { env as getRuntimeEnv } from "hono/adapter";

const server = {
	AUTH_COOKIE_DOMAIN: type("string>0 | undefined"),
	APP_FRONTEND_URL: type("string.url"),
	DATABASE_URL: type("string.url"),
	FIREBASE_API_KEY: type("string>0"),
	FIREBASE_CLIENT_EMAIL: type("string.email"),
	FIREBASE_PRIVATE_KEY: type("string>0").pipe((v) => v.replaceAll("\\n", "\n")),
	FIREBASE_PROJECT_ID: type("string>0"),
	PORT: type("string.numeric.parse | undefined").pipe((v) => v ?? 3001),
	NODE_ENV: type("'development' | 'production' | 'test' | undefined").pipe(
		(v) => v ?? "development",
	),
};

const createServerEnv = (runtimeEnv: Record<string, string | undefined>) =>
	createEnv({
		server,
		runtimeEnv,
		emptyStringAsUndefined: true,
	});

export const getEnv = (c: Context) => createServerEnv(getRuntimeEnv(c));

export const getBootEnv = () => createServerEnv(typeof process === "undefined" ? {} : process.env);
