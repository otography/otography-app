import type { Context } from "hono";

export const getAuthSession = (c: Context) => {
  return c.get("authSession");
};
