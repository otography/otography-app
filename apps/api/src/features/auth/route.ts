import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { csrfProtection, requireAuthMiddleware } from "../../shared/middleware";
import { signIn, signUp, getProfile, signOut } from "./usecase";

const credentialsBodySchema = type({
	email: type.pipe(type("string.trim"), type("string.lower"), type("string.email")),
	password: "string >= 6",
});

const credentialsValidator = arktypeValidator("json", credentialsBodySchema, (result, c) => {
	if (!result.success) {
		return c.json(
			{
				message: "Please provide a valid email address and a password with at least 6 characters.",
			},
			400,
		);
	}
});

// Chained routes for proper type inference
const auth = new Hono()
	.post("/api/auth/sign-in", csrfProtection(), credentialsValidator, (c) => {
		const { email, password } = c.req.valid("json");
		return signIn(c, email, password);
	})
	.post("/api/auth/sign-up", csrfProtection(), credentialsValidator, (c) => {
		const { email, password } = c.req.valid("json");
		return signUp(c, email, password);
	})
	.get("/api/user", requireAuthMiddleware(), getProfile)
	.post("/api/auth/sign-out", csrfProtection(), signOut);

export { auth };
