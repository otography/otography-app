import { sql } from "drizzle-orm";
import type { Database } from "../../../shared/db";
import type { CheckResult } from "./types";

// DBヘルスチェック — SELECT 1でコネクションを検証（withRls使わず直接実行）
export async function checkDatabase(db: Database): Promise<CheckResult> {
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - start),
      error: message,
    };
  }
}
