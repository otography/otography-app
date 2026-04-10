import { hc } from "hono/client";
import type { AppType } from "api";

// Next.js リライト経由（同オリジン）で API を呼び出す。
// クロスオリジン直接アクセスだと Set-Cookie ヘッダーがブラウザに反映されない。
const client = hc<AppType>("");

export const api = client.api;
