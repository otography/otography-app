import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { env } from "hono/adapter";
import { getSupabase, supabaseMiddleware } from "./middleware/auth.middleware";

const app = new Hono();

app.use("*", supabaseMiddleware());

// CSRF middleware for state-changing routes
const csrfProtection = () => {
	return csrf({
		origin: (origin, c) => {
			const { APP_FRONTEND_URL } = env<{ APP_FRONTEND_URL?: string }>(c);
			if (!APP_FRONTEND_URL) return false;
			return origin === APP_FRONTEND_URL;
		},
	});
};

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/api/user", async (c) => {
	const supabase = getSupabase(c);
	const { data, error } = await supabase.auth.getUser();

	if (error) {
		console.error("error", error);
	}

	if (!data.user) {
		return c.json({
			message: "You are not logged in.",
		});
	}

	return c.json({
		message: "You are logged in!",
		userId: data.user.id,
	});
});

app.post("/signout", csrfProtection(), async (c) => {
	const supabase = getSupabase(c);
	await supabase.auth.signOut();
	return c.body(null, 204);
});

app.get("/countries", async (c) => {
	const supabase = getSupabase(c);
	const { data, error } = await supabase.from("countries").select("*");

	if (error) {
		console.error(error);
	}

	return c.json(data);
});

const port = Number(process.env.PORT ?? 3001);

export default {
	port,
	fetch: app.fetch,
};
