import type { ApiAssistPopupId, DecisionThresholds, NormalizedDecisionResult } from "./types.ts";

export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  CHOICE_CONFIDENCE: 0.8,
  ELEMENT_PRESENT: 0.65,
  ELEMENT_ABSENT: 0.25,
};

function parseUnitInterval(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

export function readThresholds(
  env: Record<string, string | undefined> = process.env,
): DecisionThresholds {
  return {
    CHOICE_CONFIDENCE: parseUnitInterval(
      env.DRAFT_ASSIST_CHOICE_CONFIDENCE,
      DEFAULT_THRESHOLDS.CHOICE_CONFIDENCE,
    ),
    ELEMENT_PRESENT: parseUnitInterval(
      env.DRAFT_ASSIST_ELEMENT_PRESENT,
      DEFAULT_THRESHOLDS.ELEMENT_PRESENT,
    ),
    ELEMENT_ABSENT: parseUnitInterval(
      env.DRAFT_ASSIST_ELEMENT_ABSENT,
      DEFAULT_THRESHOLDS.ELEMENT_ABSENT,
    ),
  };
}

const ELEMENT_KEYS = ["space", "time", "sound", "memory", "emotion"] as const;

export function decidePopup(
  res: NormalizedDecisionResult,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
): ApiAssistPopupId | null {
  const { toneType, elements } = res;

  const presentKeys = ELEMENT_KEYS.filter((k) => elements[k] >= thresholds.ELEMENT_PRESENT);

  // 2要素以上が明確に含まれていれば十分とみなし沈黙する。
  if (presentKeys.length >= 2) {
    return null;
  }

  if (toneType.confidence >= thresholds.CHOICE_CONFIDENCE) {
    if (toneType.choice === "abstract_only") {
      return "B_ABSTRACT";
    }
    if (toneType.choice === "objective_critique") {
      return "C_CRITIQUE";
    }
  }

  if (presentKeys.length === 1) {
    const only = presentKeys[0];

    if (
      only === "emotion" &&
      elements.space <= thresholds.ELEMENT_ABSENT &&
      elements.time <= thresholds.ELEMENT_ABSENT
    ) {
      return "D_EMOTION_ONLY";
    }
    if ((only === "space" || only === "time") && elements.sound <= thresholds.ELEMENT_ABSENT) {
      return "D_CONTEXT_ONLY";
    }
    if (only === "sound" && elements.emotion <= thresholds.ELEMENT_ABSENT) {
      return "D_SOUND_ONLY";
    }
    if (only === "memory" && elements.emotion <= thresholds.ELEMENT_ABSENT) {
      return "D_MEMORY_ONLY";
    }
  }

  return null;
}
