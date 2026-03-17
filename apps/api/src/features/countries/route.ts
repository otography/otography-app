import { Hono } from "hono";
import { getSupabase } from "../../shared/middleware";

const countries = new Hono();

countries.get("/countries", async (c) => {
	const supabase = getSupabase(c);
	const { data, error } = await supabase.from("countries").select("*");

	if (error) {
		console.error(error);
		return c.json({ message: "Failed to fetch countries" }, 500);
	}

	return c.json(data);
});

export { countries };
