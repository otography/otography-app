import type { CheckResult } from "./types";

// Apple Musicヘルスチェックのタイムアウト（ms）
const APPLE_MUSIC_TIMEOUT_MS = 3000;
const APPLE_MUSIC_CHECK_URL = "https://api.music.apple.com";

// Apple Musicヘルスチェック — fetchで到達性を確認（non-critical）
export async function checkAppleMusic(): Promise<CheckResult> {
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
