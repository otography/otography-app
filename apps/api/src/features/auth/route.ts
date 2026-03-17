import { Hono } from "hono";
import { csrfProtection, getSupabase } from "../../shared/middleware";

const auth = new Hono();

// Auth error codes from Supabase
const AUTH_ERROR_CODES = [
	"session_expired",
	"session_not_found",
	"user_not_found",
	"bad_jwt",
	"no_authorization",
];

auth.get("/api/user", async (c) => {
	const supabase = getSupabase(c);
	const { data, error } = await supabase.auth.getClaims();

	if (error) {
		// Client-side auth issues (not logged in, expired session, etc.) - return 401
		if (AUTH_ERROR_CODES.includes(error.code ?? "")) {
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

auth.post("/signout", csrfProtection(), async (c) => {
	const supabase = getSupabase(c);
	await supabase.auth.signOut();
	return c.body(null, 204);
});

export { auth };
