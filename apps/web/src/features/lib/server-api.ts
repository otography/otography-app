import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { hc } from "hono/client";
import type { AppType } from "api";
import { env } from "@/env";

/**
 * サーバーコンポーネント用の型安全 API クライアント。
 * React cache() で同一レンダー内の呼び出しをキャッシュする。
 * クッキーはリクエストスコープの cookies() から自動で取得するため、
 * 呼び出し側は認証を意識する必要がない。
 */
export const getServerApi = cache(async () => {
  const cookieStore = await cookies();
  const origin =
    process.env.VERCEL_ENV === "preview"
      ? await (async () => {
          const headersList = await headers();
          const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
          return host
            ? `${headersList.get("x-forwarded-proto") ?? "https"}://${host}`
            : env.NEXT_PUBLIC_API_URL;
        })()
      : env.NEXT_PUBLIC_API_URL;

  const client = hc<AppType>(origin, {
    headers: async () => ({
      cookie: cookieStore.toString(),
    }),
    init: {
      cache: "no-store",
    },
  });
  return client.api;
});
