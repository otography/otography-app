import type { InferRequestType } from "hono/client";
import { client } from "#/lib/api";

export type AssistPopupId =
  | "A_STALLED"
  | "B_ABSTRACT"
  | "C_CRITIQUE"
  | "D_EMOTION_ONLY"
  | "D_CONTEXT_ONLY"
  | "D_SOUND_ONLY"
  | "D_MEMORY_ONLY"
  | "E_DEEPEN_GENERAL"
  | "E_DEEPEN_CONTEXT"
  | "E_DEEPEN_SOUND"
  | "E_DEEPEN_MEMORY"
  | "E_DEEPEN_EMOTION";

export type ApiAssistPopupId = Exclude<AssistPopupId, "A_STALLED">;

export interface DraftAssistRequest {
  draftSessionId: string;
  trackTitle: string;
  draftText: string;
}

export interface DraftAssistResponse {
  popupId: ApiAssistPopupId | null;
  modelVersion: string;
}

export type DraftAssistBehaviorEvent = InferRequestType<
  (typeof client.api)["draft-assist"]["events"]["$post"]
>["json"];

export async function requestDraftAssist(
  input: DraftAssistRequest,
  signal?: AbortSignal,
): Promise<DraftAssistResponse | null> {
  try {
    const res = await client.api["draft-assist"].$post({ json: input }, { init: { signal } });
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    return body;
  } catch {
    return null;
  }
}

export function sendDraftAssistEvent(
  event: DraftAssistBehaviorEvent,
  options?: { keepalive?: boolean },
): void {
  const payload = JSON.stringify(event);
  if (options?.keepalive && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/draft-assist/events", blob)) {
      return;
    }
  }
  void fetch("/api/draft-assist/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: options?.keepalive,
  }).catch(() => {});
}
