import { hc } from "hono/client";
import type { AppType } from "api";

const BUSY = "混雑しています。しばらく待ってから、もう一度試してください";

/**
 * API の応答が JSON でない失敗（Cloudflare が返すエラーのページ。1 日の枠が尽きたときのエラー 1027 など）を、
 * 画面が扱える JSON の形 { error } に置き換える。SPA の画面は表示され続ける。
 */
const fetchApi: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.ok || res.headers.get("content-type")?.includes("application/json")) {
    return res;
  }
  return Response.json({ error: BUSY }, { status: res.status, statusText: res.statusText });
};

export const client = hc<AppType>("/", { fetch: fetchApi });
