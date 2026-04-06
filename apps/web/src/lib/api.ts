import { hc } from "hono/client";
import type { AppType } from "api";
import { env } from "@/env";

const client = hc<AppType>(env.NEXT_PUBLIC_API_URL, {
  init: {
    credentials: "include",
  },
});

export const api = client.api;
