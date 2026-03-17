import { Hono } from "hono";
import { getSupabase, supabaseMiddleware } from "./middleware/auth.middleware";
import { csrfProtection } from "./middleware/csrf.middleware";
import { env } from "./env";

const app = new Hono();

app.use("*", supabaseMiddleware());

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/api/user", async (c) => {
	const supabase = getSupabase(c);
	const { data, error } = await supabase.auth.getClaims();

	if (error) {
		// Client-side auth issues (not logged in, expired session, etc.) - return 401
		const authErrorCodes = [
			"session_expired",
			"session_not_found",
			"user_not_found",
			"bad_jwt",
			"no_authorization",
		];
		if (authErrorCodes.includes(error.code ?? "")) {
			return c.json({ message: "You are not logged in." }, 401);
		}
		// Other errors (service degraded, timeout, etc.) - return 500
		return c.json({ message: "Auth lookup failed" }, 500);
	}

	if (!data?.claims) {
		return c.json({ message: "You are not logged in." }, 401);
	}

	return c.json({
		message: "You are logged in!",
		userId: data.claims.id,
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
		return c.json({ message: "Failed to fetch countries" }, 500);
	}

	return c.json(data);
});

const port = env.PORT;

export default {
	port,
	fetch: app.fetch,
};
