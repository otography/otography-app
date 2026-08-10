import { Hono } from "hono";
import { findProblemType } from "../../shared/errors/error-registry";
import { renderErrorDocHtml, renderErrorDocJson } from "./render";

const errors = new Hono().get("/:type", (c) => {
  const slug = c.req.param("type");
  const entry = findProblemType(slug);

  if (!entry) {
    return c.notFound();
  }

  const accept = c.req.header("Accept") ?? "";

  // エラー型の説明ドキュメントなので ProblemDetails の発生レスポンスではなく JSON として返す
  if (accept.includes("application/json") || accept.includes("application/problem+json")) {
    return c.json(renderErrorDocJson(entry), 200, { "Content-Type": "application/json" });
  }

  // デフォルト → HTML レスポンス
  return c.body(renderErrorDocHtml(entry), 200, {
    "Content-Type": "text/html; charset=utf-8",
  });
});

export { errors };
