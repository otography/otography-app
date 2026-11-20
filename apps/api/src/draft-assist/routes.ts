import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth } from "../auth/session.ts";
import type { SessionEnv } from "../auth/session.ts";
import { logWarning } from "../lib/log.ts";
import { CLEF_FLASH_MODEL_VERSION } from "./adapter.ts";
import { readThresholds } from "./decide.ts";
import { draftAssistEventInput, draftAssistInput } from "./schemas.ts";
import type { DraftAssistResponse } from "./types.ts";
import { evaluateDraft } from "./usecases/evaluate-draft.ts";
import { checkDraftAssistRateLimit, getWorkerDecisionAdapter } from "./worker.ts";

const silentResponse = (modelVersion: string): DraftAssistResponse => ({
  popupId: null,
  modelVersion,
});

export const draftAssistRoutes = new Hono<SessionEnv>()
  .post(
    "/",
    requireAuth,
    zValidator("json", draftAssistInput, (result, c) => {
      if (!result.success) {
        return c.json(silentResponse(CLEF_FLASH_MODEL_VERSION), 200);
      }
    }),
    async (c) => {
      const adapter = getWorkerDecisionAdapter();
      if (adapter instanceof Error) {
        logWarning(adapter.message, adapter);
        return c.json(silentResponse(CLEF_FLASH_MODEL_VERSION), 200);
      }

      // レート制限超過時は HTTP 200 で popupId: null を返し、投稿体験を止めない（フェイルオープン原則）。
      const allowed = await checkDraftAssistRateLimit(c.get("user").id);
      if (!allowed) {
        return c.json(silentResponse(adapter.modelVersion), 200);
      }

      const response = await evaluateDraft({
        adapter,
        input: c.req.valid("json"),
        thresholds: readThresholds(process.env),
      });
      return c.json(response, 200);
    },
  )
  .post(
    "/events",
    requireAuth,
    zValidator("json", draftAssistEventInput, (result, c) => {
      if (!result.success) {
        return c.body(null, 204);
      }
    }),
    (c) => {
      console.log(
        JSON.stringify({
          category: "draft_assist_behavior",
          ...c.req.valid("json"),
        }),
      );
      return c.body(null, 204);
    },
  );
