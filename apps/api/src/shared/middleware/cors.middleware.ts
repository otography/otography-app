import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

// c.env はリクエスト時にしか利用できないため、ハンドラー内でcorsミドルウェアを都度生成する。
export const corsMiddleware: MiddlewareHandler<Env> = (c, next) => {
  const middleware = cors({
    origin: c.env.APP_FRONTEND_URL,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  return middleware(c, next);
};
