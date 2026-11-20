import { z } from "zod";
import { ASSIST_POPUP_IDS } from "./types.ts";

export const draftAssistInput = z.object({
  draftSessionId: z.string().trim().min(1).max(128),
  trackTitle: z.string().trim().min(1).max(200),
  draftText: z.string().trim().min(1).max(200),
});

export const draftAssistEventInput = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("assist_shown"),
    draftSessionId: z.string().trim().min(1).max(128),
    popupId: z.enum(ASSIST_POPUP_IDS),
    textLength: z.number().int().min(0).max(1000),
    modelVersion: z.string().max(128).optional(),
  }),
  z.object({
    event: z.literal("assist_dismissed"),
    draftSessionId: z.string().trim().min(1).max(128),
    popupId: z.enum(ASSIST_POPUP_IDS),
    method: z.enum(["button", "swipe"]),
    textLength: z.number().int().min(0).max(1000),
  }),
  z.object({
    event: z.literal("draft_submitted"),
    draftSessionId: z.string().trim().min(1).max(128),
    finalTextLength: z.number().int().min(0).max(1000),
    appendedAfterAssist: z.boolean(),
    shownCount: z.number().int().min(0).max(10),
    shownPopupIds: z.array(z.enum(ASSIST_POPUP_IDS)).max(10),
  }),
  z.object({
    event: z.literal("draft_abandoned"),
    draftSessionId: z.string().trim().min(1).max(128),
    lastTextLength: z.number().int().min(0).max(1000),
    shownCount: z.number().int().min(0).max(10),
    shownPopupIds: z.array(z.enum(ASSIST_POPUP_IDS)).max(10),
  }),
]);
