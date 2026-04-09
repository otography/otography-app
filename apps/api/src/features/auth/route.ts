import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { AuthError } from "@repo/errors/server";
import { csrfProtection, requireAuthMiddleware, getAuthSession } from "../../shared/middleware";
import { setSessionCookie, clearSessionCookie } from "../../shared/session";
import type { Bindings } from "../../shared/types/bindings";
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

const handleAuthError = (error: AuthError, c: Context<{ Bindings: Bindings }>) => {
  if (error.clearCookie) clearSessionCookie(c);
  return c.json({ message: error.message }, error.statusCode);
};

// Chained routes for proper type inference
const auth = new Hono<{ Bindings: Bindings }>()
  .post("/api/auth/sign-in", csrfProtection(), credentialsValidator, async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await signIn(c.env.FIREBASE_API_KEY, email, password);
    if (result instanceof Error) return handleAuthError(result, c);
    setSessionCookie(c, result.sessionCookie);
    return c.json({ message: "Signed in successfully." }, 200);
  })
  .post("/api/auth/sign-up", csrfProtection(), credentialsValidator, async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await signUp(c.env.FIREBASE_API_KEY, email, password);
    if (result instanceof Error) return handleAuthError(result, c);
    setSessionCookie(c, result.sessionCookie);
    return c.json({ message: "Account created successfully." }, 201);
  })
  .get("/api/user", requireAuthMiddleware(), async (c) => {
    const session = getAuthSession(c);
    if (!session) {
      return c.json({ message: "You are not logged in." }, 401);
    }
    const result = await getProfile(session);
    if (result instanceof Error) return handleAuthError(result, c);
    return c.json({ message: "You are logged in!", ...result });
  })
  .post("/api/auth/sign-out", csrfProtection(), async (c) => {
    const session = getAuthSession(c);
    const result = await signOut(session);
    if (result instanceof Error) return handleAuthError(result, c);
    if (result.clearSession) clearSessionCookie(c);
    return c.body(null, 204);
  });

export { auth };
