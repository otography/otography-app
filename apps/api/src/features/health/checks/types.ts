// ヘルスチェック共通の型定義

export type CheckStatus = "ok" | "unhealthy" | "degraded";

export interface CheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}
