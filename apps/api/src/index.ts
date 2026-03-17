import { Hono } from "hono";
import { supabaseMiddleware } from "./shared/middleware";
import { auth } from "./features/auth";
import { countries } from "./features/countries";
import { env } from "./env";

const app = new Hono();

app.use("*", supabaseMiddleware());

// Mount feature routes
app.route("/", auth);
app.route("/", countries);

// Root route
app.get("/", (c) => c.text("Hello Hono!"));

const port = env.PORT;

export default {
	port,
	fetch: app.fetch,
};

// Export for Hono RPC client
export type AppType = typeof app;
