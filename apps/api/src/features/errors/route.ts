import { Hono } from "hono";
import { findProblemType } from "../../shared/errors/error-registry";

const errors = new Hono().get("/:type", (c) => {
  const slug = c.req.param("type");
  const entry = findProblemType(slug);

  if (!entry) {
    return c.notFound();
  }

  const accept = c.req.header("Accept") ?? "";

  // Accept: application/problem+json → JSON レスポンス
  if (accept.includes("application/problem+json")) {
    return c.json(
      {
        type: entry.typeUri,
        title: entry.title,
        status: entry.statusCode,
        description: entry.description,
      },
      200,
      { "Content-Type": "application/problem+json" },
    );
  }

  // デフォルト → HTML レスポンス
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${entry.title}</title>
  <style>body{font-family:sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#333}h1{color:#c00}pre{background:#f5f5f5;padding:1rem;border-radius:4px;overflow-x:auto}</style>
</head>
<body>
  <h1>${entry.title}</h1>
  <p>${entry.description}</p>
  <pre>{
  "type": "${entry.typeUri}",
  "title": "${entry.title}",
  "status": ${entry.statusCode}
}</pre>
</body>
</html>`;

  return c.body(html, 200, {
    "Content-Type": "text/html; charset=utf-8",
  });
});

export { errors };
