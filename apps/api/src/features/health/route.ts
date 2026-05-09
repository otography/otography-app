import { Hono } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { sql } from "drizzle-orm";
import { createDb } from "../../shared/db";
import type { Bindings } from "../../shared/types/bindings";

// Apple Musicヘルスチェックのタイムアウト（ms）
const APPLE_MUSIC_TIMEOUT_MS = 3000;
const APPLE_MUSIC_CHECK_URL = "https://api.music.apple.com";

type CheckStatus = "ok" | "unhealthy" | "degraded";

interface CheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}

// DBヘルスチェック — SELECT 1でコネクションを検証（withRls使わず直接実行）
async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  try {
    const db = createDb();
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

// Firebaseヘルスチェック — 必要なenv変数の存在を確認
function checkFirebase(env: Bindings): CheckResult {
  const start = performance.now();
  const required: (keyof Bindings)[] = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    return {
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - start),
      error: `Missing: ${missing.join(", ")}`,
    };
  }
  return { status: "ok", latencyMs: Math.round(performance.now() - start) };
}

// Apple Musicヘルスチェック — fetchで到達性を確認（non-critical）
async function checkAppleMusic(): Promise<CheckResult> {
  const start = performance.now();
  try {
    await fetch(APPLE_MUSIC_CHECK_URL, {
      signal: AbortSignal.timeout(APPLE_MUSIC_TIMEOUT_MS),
    });
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch {
    return {
      status: "degraded",
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

const health = new Hono<{ Bindings: Bindings }>()
  // livenessプローブ — プロセスが生存していることを確認する軽量エンドポイント
  .get("/", (c) => {
    return c.json({ status: "ok" }, 200, {
      "Cache-Control": "no-store",
    });
  })
  // readinessプローブ — 依存関係の健全性を確認
  .get("/ready", async (c) => {
    // 全チェックを並列実行
    const [database, firebase, appleMusic] = await Promise.all([
      checkDatabase(),
      checkFirebase(c.env),
      checkAppleMusic(),
    ]);

    const checks = { database, firebase, appleMusic };

    // クリティカルな依存関係（DB, Firebase）がunhealthyなら全体も503
    const criticalDown = database.status === "unhealthy" || firebase.status === "unhealthy";
    // Apple Musicはnon-critical — degradedでも全体は503にしない
    const hasDegraded = appleMusic.status === "degraded";

    let overallStatus: string;
    let httpStatus: StatusCode;
    if (criticalDown) {
      overallStatus = "unhealthy";
      httpStatus = 503;
    } else if (hasDegraded) {
      overallStatus = "degraded";
      httpStatus = 200;
    } else {
      overallStatus = "ok";
      httpStatus = 200;
    }

    return c.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
      },
      httpStatus,
      { "Cache-Control": "no-store" },
    );
  });

export { health };
