import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../../shared/types/env";
import { checkDatabase } from "./checks/database";
import { checkFirebase } from "./checks/firebase";
import { checkAppleMusic } from "./checks/apple-music";
import { aggregateStatus, type HealthChecks } from "./aggregate";

async function resolveChecks(c: Context<Env>): Promise<HealthChecks> {
  const [database, firebase, appleMusic] = await Promise.all([
    checkDatabase(c.var.db()),
    checkFirebase(c.env),
    checkAppleMusic(),
  ]);
  return { database, firebase, appleMusic };
}

const health = new Hono<Env>()
  // livenessプローブ — プロセスが生存していることを確認する軽量エンドポイント
  .get("/", (c) => {
    return c.json({ status: "ok" }, 200, {
      "Cache-Control": "no-store",
    });
  })
  // readinessプローブ — 依存関係の健全性を確認
  .get("/ready", async (c) => {
    const checks = await resolveChecks(c);
    const { status, httpStatus } = aggregateStatus(checks);

    return c.json(
      {
        status,
        timestamp: new Date().toISOString(),
        checks,
      },
      httpStatus,
      { "Cache-Control": "no-store" },
    );
  });

export { health };
