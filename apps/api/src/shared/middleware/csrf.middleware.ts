import { createMiddleware } from "hono/factory";
import { csrf } from "hono/csrf";
import type { Env } from "../types/env";

export const csrfProtection = () =>
  createMiddleware<Env>(async (c, next) => {
    const middleware = csrf({
      origin: (origin) => {
        return origin === c.env.APP_FRONTEND_URL;
      },
    });

    return middleware(c, next);
  });
