import type { Bindings } from "../../../shared/types/bindings";
import type { CheckResult } from "./types";

// Firebaseヘルスチェック — 必要なenv変数の存在を確認
export function checkFirebase(env: Bindings): CheckResult {
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
