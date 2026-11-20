export const ASSIST_POPUP_IDS = [
  "A_STALLED",
  "B_ABSTRACT",
  "C_CRITIQUE",
  "D_EMOTION_ONLY",
  "D_CONTEXT_ONLY",
  "D_SOUND_ONLY",
  "D_MEMORY_ONLY",
] as const;

type AssistPopupId = (typeof ASSIST_POPUP_IDS)[number];

export type ApiAssistPopupId = Exclude<AssistPopupId, "A_STALLED">;

export type ToneChoice = "abstract_only" | "objective_critique" | "personal_experience" | "other";

export interface DraftAssistRequest {
  draftSessionId: string;
  trackTitle: string;
  draftText: string;
}

export interface DraftAssistResponse {
  popupId: ApiAssistPopupId | null;
  modelVersion: string;
}

export interface NormalizedDecisionResult {
  modelVersion: string;
  toneType: {
    choice: ToneChoice;
    confidence: number;
  };
  elements: {
    space: number;
    time: number;
    sound: number;
    memory: number;
    emotion: number;
  };
}

export interface DecisionThresholds {
  CHOICE_CONFIDENCE: number;
  ELEMENT_PRESENT: number;
  ELEMENT_ABSENT: number;
}
