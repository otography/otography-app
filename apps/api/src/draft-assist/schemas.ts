import { z } from "zod";
import { ASSIST_POPUP_IDS, EMPTY_HINT_ANGLE_IDS, MESSAGE_ANGLES } from "./types.ts";

export const draftAssistInput = z.object({
  draftSessionId: z.string().trim().min(1).max(128),
  trackTitle: z.string().trim().min(1).max(200),
  draftText: z.string().trim().min(1).max(200),
});

export const draftAssistEventInput = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("empty_hint_tapped"),
    draftSessionId: z.string().trim().min(1).max(128),
    angle: z.enum(EMPTY_HINT_ANGLE_IDS),
  }),
  z.object({
    event: z.literal("assist_shown"),
    draftSessionId: z.string().trim().min(1).max(128),
    popupId: z.enum(ASSIST_POPUP_IDS),
    messageIndex: z.number().int().min(0).max(100),
    messageAngle: z.enum(MESSAGE_ANGLES),
    charCountAtShown: z.number().int().min(0).max(1000),
    modelVersion: z.string().max(128).optional(),
  }),
  z.object({
    event: z.literal("assist_dismissed"),
    draftSessionId: z.string().trim().min(1).max(128),
    popupId: z.enum(ASSIST_POPUP_IDS),
    messageAngle: z.enum(MESSAGE_ANGLES),
    method: z.enum(["button", "swipe"]),
  }),
  z.object({
    event: z.literal("draft_submitted"),
    draftSessionId: z.string().trim().min(1).max(128),
    finalCharCount: z.number().int().min(0).max(1000),
    appendedAfterAssist: z.boolean(),
    shownCount: z.number().int().min(0).max(10),
    shownPopupIds: z.array(z.enum(ASSIST_POPUP_IDS)).max(10),
  }),
  z.object({
    event: z.literal("draft_abandoned"),
    draftSessionId: z.string().trim().min(1).max(128),
    lastShownPopupId: z.enum(ASSIST_POPUP_IDS),
    lastMessageAngle: z.enum(MESSAGE_ANGLES),
    shownCount: z.number().int().min(0).max(10),
    shownPopupIds: z.array(z.enum(ASSIST_POPUP_IDS)).max(10),
  }),
]);
