import type { Context, MiddlewareHandler } from "hono";
import { verifySessionCookie } from "../firebase-auth";
import { clearSessionCookie, getSessionCookie } from "../session";

export const getAuthSession = (c: Context) => {
  return c.get("authSession");
};

export const authSessionMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    c.set("authSession", null);
    const sessionCookie = getSessionCookie(c);

    if (!sessionCookie) {
      await next();
      return;
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      if (claims.clearCookie) clearSessionCookie(c);
      await next();
      return;
    }

    const userId = typeof claims?.sub === "string" ? claims.sub : null;

    if (!userId) {
      await next();
      return;
    }

    c.set("authSession", claims);

    await next();
  };
};

export const requireAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    if (c.get("authSession")) {
      await next();
      return;
    }

    const sessionCookie = getSessionCookie(c);

    if (!sessionCookie) {
      return c.json({ message: "You are not logged in." }, 401);
    }

    const claims = await verifySessionCookie(sessionCookie);

    if (claims instanceof Error) {
      if (claims.clearCookie) clearSessionCookie(c);
      return c.json({ message: claims.message }, claims.statusCode);
    }

    c.set("authSession", claims);
    await next();
  };
};
