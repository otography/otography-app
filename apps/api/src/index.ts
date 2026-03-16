import { Hono } from "hono";
import { getSupabase, supabaseMiddleware } from "./middleware/auth.middleware";

const app = new Hono();

app.use("*", supabaseMiddleware());

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

app.get("/signout", async (c) => {
	const supabase = getSupabase(c);
	await supabase.auth.signOut();
	return c.redirect("/");
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
