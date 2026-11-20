import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";

export type Me = InferResponseType<typeof client.api.me.$get, 200>;

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const res = await client.api.me.$get();
    return res.ok ? res.json() : null;
  },
});
