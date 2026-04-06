import { env } from "cloudflare:test";
import { app } from "../..";

type TestRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookie?: Record<string, string>;
};

type TestResponse = {
  status: number;
  headers: Headers;
  json: () => Promise<Record<string, unknown>>;
  text: () => Promise<string>;
  getCookie: (name: string) => string | undefined;
};

export async function testRequest(
  path: string,
  options: TestRequestOptions = {},
): Promise<TestResponse> {
  const { method = "GET", headers = {}, body, cookie = {} } = options;

  const headerEntries: [string, string][] = Object.entries(headers);

  if (Object.keys(cookie).length > 0) {
    headerEntries.push([
      "Cookie",
      Object.entries(cookie)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    ]);
  }

  if (body !== undefined) {
    if (!headerEntries.some(([k]) => k.toLowerCase() === "content-type")) {
      headerEntries.push(["Content-Type", "application/json"]);
    }
  }

  const response = await app.request(
    new URL(path, "http://localhost:3001"),
    {
      method,
      headers: headerEntries,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    env,
  );

  return {
    status: response.status,
    headers: response.headers,
    json: () => response.clone().json() as Promise<Record<string, unknown>>,
    text: () => response.clone().text(),
    getCookie: (name: string) => {
      const setCookie = response.headers.getSetCookie();
      const match = setCookie.find((c) => c.startsWith(`${name}=`));
      if (match === undefined) return undefined;
      const [first] = match.split(";");
      if (first === undefined) return undefined;
      const eqIndex = first.indexOf("=");
      if (eqIndex === -1) return undefined;
      return first.slice(eqIndex + 1);
    },
  };
}
