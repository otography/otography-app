import { env } from "cloudflare:workers";
import { RateLimitCheckError } from "../lib/rate-limit/errors.ts";
import { logWarning } from "../lib/log.ts";
import { resolveDecisionAdapter } from "./adapter.ts";
import type { RunAiFn } from "./adapter.ts";

// Worker のバインディング（AI・DRAFT_ASSIST_RATE_LIMIT）を使う実装。テストからは読み込まない。

// Workers AI の型定義に未登録のモデル（@cf/cloudflare/clef-flash 等）を呼ぶためのブリッジ。
function runCustomAiModel(ai: typeof env.AI): RunAiFn {
  const raw: unknown = ai;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (model, payload) => (raw as { run: RunAiFn }).run(model, payload);
}

export function getWorkerDecisionAdapter() {
  return resolveDecisionAdapter({
    env: process.env,
    runAi: runCustomAiModel(env.AI),
  });
}

export async function checkDraftAssistRateLimit(userId: string): Promise<boolean> {
  const outcome = await env.DRAFT_ASSIST_RATE_LIMIT.limit({ key: userId }).catch(
    (error: unknown) =>
      new RateLimitCheckError({ limiter: "DRAFT_ASSIST_RATE_LIMIT", cause: error }),
  );
  if (outcome instanceof Error) {
    logWarning(outcome.message, outcome.cause);
    return true;
  }
  return outcome.success;
}
