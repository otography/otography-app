import type {
  AssistPopupId,
  DecisionThresholds,
  NormalizedDecisionResult,
  ShallowSingleStrategy,
} from "./types.ts";

export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  CHOICE_CONFIDENCE: 0.8,
  ELEMENT_PRESENT: 0.65,
  ELEMENT_ABSENT: 0.25,
  DETAIL_DEEP: 0.65,
  DETAIL_SHALLOW: 0.25,
};

export const DEFAULT_SHALLOW_SINGLE_STRATEGY: ShallowSingleStrategy = "deepen";

const ELEMENT_KEYS = ["space", "time", "sound", "memory", "emotion"] as const;

export function decidePopup(
  res: NormalizedDecisionResult,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
  shallowSingleStrategy: ShallowSingleStrategy = DEFAULT_SHALLOW_SINGLE_STRATEGY,
): AssistPopupId | null {
  const { toneType, elements, concreteDetail } = res;

  const presentKeys = ELEMENT_KEYS.filter((k) => elements[k] >= thresholds.ELEMENT_PRESENT);
  const isShallow = concreteDetail <= thresholds.DETAIL_SHALLOW;

  // 1. [最優先：軸のズレ] 作品への客観評価・批評寄り
  if (
    toneType.confidence >= thresholds.CHOICE_CONFIDENCE &&
    toneType.choice === "objective_critique"
  ) {
    return "C_CRITIQUE";
  }

  // 2. [幅2以上] 複数要素が揃っている場合
  if (presentKeys.length >= 2) {
    if (isShallow) {
      return "E_DEEPEN_GENERAL";
    }
    return null;
  }

  // 3. [幅0・抽象語のみ] 起点の具体化
  if (toneType.confidence >= thresholds.CHOICE_CONFIDENCE && toneType.choice === "abstract_only") {
    return "B_ABSTRACT";
  }

  // 4. [幅1] 単一要素のみ明確な場合
  if (presentKeys.length === 1) {
    const only = presentKeys[0];

    // 4-A. 明確に浅い場合（戦略フラグに応じて深掘り or 横の拡張）
    if (isShallow && shallowSingleStrategy === "deepen") {
      if (only === "space" || only === "time") {
        return "E_DEEPEN_CONTEXT";
      }
      if (only === "sound") {
        return "E_DEEPEN_SOUND";
      }
      if (only === "memory") {
        return "E_DEEPEN_MEMORY";
      }
      if (only === "emotion") {
        return "E_DEEPEN_EMOTION";
      }
    }

    // 4-B. 深い、中間帯、または横拡張戦略の場合
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
