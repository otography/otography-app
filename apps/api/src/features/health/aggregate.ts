import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { CheckResult } from "./checks/types";

export interface HealthChecks {
  database: CheckResult;
  firebase: CheckResult;
  appleMusic: CheckResult;
}

type OverallStatus = "ok" | "degraded" | "unhealthy";

interface AggregatedStatus {
  status: OverallStatus;
  httpStatus: ContentfulStatusCode;
}

// 依存関係チェック結果から全体ステータスを判定する。
// DB/Firebaseはcritical（unhealthyなら全体も503）、Apple Musicはnon-critical
// （degradedでも200のまま）というビジネスルールをここに集約する。
export function aggregateStatus(checks: HealthChecks): AggregatedStatus {
  const criticalDown =
    checks.database.status === "unhealthy" || checks.firebase.status === "unhealthy";
  const hasDegraded = checks.appleMusic.status === "degraded";

  if (criticalDown) {
    return { status: "unhealthy", httpStatus: 503 };
  }
  if (hasDegraded) {
    return { status: "degraded", httpStatus: 200 };
  }
  return { status: "ok", httpStatus: 200 };
}
