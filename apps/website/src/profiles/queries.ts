import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";

/** ログイン中のユーザー。未ログインなら null。 */
export const meQuery = queryOptions({
  queryKey: ["me"],
  // 200 ならログイン中、401 なら未ログイン（API の /api/me）。
  queryFn: async () => {
    const res = await client.api.me.$get();
    return res.ok ? res.json() : null;
  },
});

export type Profile = InferResponseType<(typeof client.api.users)[":publicId"]["$get"], 200>;

/** 公開 ID のユーザーのプロフィール。 */
export const profileQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["profile", publicId],
    queryFn: async () => {
      const res = await client.api.users[":publicId"].$get({ param: { publicId } });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
  });
