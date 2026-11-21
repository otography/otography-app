export const ASSIST_POPUP_IDS = [
  "B_ABSTRACT",
  "C_CRITIQUE",
  "D_EMOTION_ONLY",
  "D_CONTEXT_ONLY",
  "D_SOUND_ONLY",
  "D_MEMORY_ONLY",
  "E_DEEPEN_GENERAL",
  "E_DEEPEN_CONTEXT",
  "E_DEEPEN_SOUND",
  "E_DEEPEN_MEMORY",
  "E_DEEPEN_EMOTION",
] as const;

export type AssistPopupId = (typeof ASSIST_POPUP_IDS)[number];

export const EMPTY_HINT_ANGLE_IDS = ["mood", "scene", "sound", "memory"] as const;

export const MESSAGE_ANGLES = [
  "zoom_in",
  "sensory",
  "contrast",
  "role_or_who",
  "reflective_why",
  "reframe_self",
  "widen_dimension",
] as const;

export type ToneChoice = "abstract_only" | "objective_critique" | "personal_experience" | "other";

export type ShallowSingleStrategy = "deepen" | "widen";

export interface DraftAssistRequest {
  draftSessionId: string;
  trackTitle: string;
  draftText: string;
}

export interface DraftAssistResponse {
  popupId: AssistPopupId | null;
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
  concreteDetail: number;
}

export interface DecisionThresholds {
  CHOICE_CONFIDENCE: number;
  ELEMENT_PRESENT: number;
  ELEMENT_ABSENT: number;
  DETAIL_DEEP: number;
  DETAIL_SHALLOW: number;
}
