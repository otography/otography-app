import { describe, expect, test } from "vite-plus/test";
import { decidePopup, DEFAULT_THRESHOLDS } from "../../src/draft-assist/decide.ts";
import type { NormalizedDecisionResult } from "../../src/draft-assist/types.ts";

function makeResult(
  overrides: Partial<{
    toneType: NormalizedDecisionResult["toneType"];
    elements: Partial<NormalizedDecisionResult["elements"]>;
    concreteDetail: number;
  }> = {},
): NormalizedDecisionResult {
  return {
    modelVersion: "clef-flash",
    toneType: overrides.toneType ?? { choice: "other", confidence: 0.4 },
    elements: {
      space: 0.1,
      time: 0.1,
      sound: 0.1,
      memory: 0.1,
      emotion: 0.1,
      ...overrides.elements,
    },
    concreteDetail: overrides.concreteDetail ?? 0.5,
  };
}

describe("decidePopup", () => {
  test("軸のズレ（objective_critique）は要素数2以上より最優先で C_CRITIQUE を返す", () => {
    const res = makeResult({
      toneType: { choice: "objective_critique", confidence: 0.91 },
      elements: { space: 0.8, sound: 0.8 },
      concreteDetail: 0.9,
    });
    expect(decidePopup(res)).toBe("C_CRITIQUE");
  });

  test("幅2以上で明確に浅い場合のみ E_DEEPEN_GENERAL を返し、中間帯・深い場合は沈黙する", () => {
    expect(
      decidePopup(
        makeResult({
          toneType: { choice: "abstract_only", confidence: 0.95 },
          elements: { time: 0.8, emotion: 0.7 },
          concreteDetail: 0.25,
        }),
      ),
    ).toBe("E_DEEPEN_GENERAL");

    expect(
      decidePopup(
        makeResult({
          elements: { space: 0.7, sound: 0.65 },
          concreteDetail: 0.4,
        }),
      ),
    ).toBeNull();

    expect(
      decidePopup(
        makeResult({
          elements: { space: 0.7, sound: 0.65 },
          concreteDetail: 0.85,
        }),
      ),
    ).toBeNull();
  });

  test("幅0かつ abstract_only の確信度が閾値以上なら B_ABSTRACT、未満や personal_experience / other は沈黙", () => {
    expect(
      decidePopup(makeResult({ toneType: { choice: "abstract_only", confidence: 0.8 } })),
    ).toBe("B_ABSTRACT");
    expect(
      decidePopup(makeResult({ toneType: { choice: "abstract_only", confidence: 0.79 } })),
    ).toBeNull();
    expect(
      decidePopup(makeResult({ toneType: { choice: "personal_experience", confidence: 0.95 } })),
    ).toBeNull();
    expect(decidePopup(makeResult({ toneType: { choice: "other", confidence: 0.95 } }))).toBeNull();
  });

  test("幅1かつ明確に浅い場合（deepen戦略）は各要素の E_DEEPEN_* を返す", () => {
    expect(decidePopup(makeResult({ elements: { space: 0.8 }, concreteDetail: 0.2 }))).toBe(
      "E_DEEPEN_CONTEXT",
    );
    expect(decidePopup(makeResult({ elements: { time: 0.8 }, concreteDetail: 0.25 }))).toBe(
      "E_DEEPEN_CONTEXT",
    );
    expect(decidePopup(makeResult({ elements: { sound: 0.8 }, concreteDetail: 0.15 }))).toBe(
      "E_DEEPEN_SOUND",
    );
    expect(decidePopup(makeResult({ elements: { memory: 0.8 }, concreteDetail: 0.2 }))).toBe(
      "E_DEEPEN_MEMORY",
    );
    expect(decidePopup(makeResult({ elements: { emotion: 0.8 }, concreteDetail: 0.2 }))).toBe(
      "E_DEEPEN_EMOTION",
    );
  });

  test("幅1かつ浅い場合でも widen 戦略なら横の拡張（D_*）にフォールバックする", () => {
    expect(
      decidePopup(
        makeResult({ elements: { emotion: 0.8, space: 0.1, time: 0.1 }, concreteDetail: 0.2 }),
        DEFAULT_THRESHOLDS,
        "widen",
      ),
    ).toBe("D_EMOTION_ONLY");
    expect(
      decidePopup(
        makeResult({ elements: { time: 0.8, sound: 0.1 }, concreteDetail: 0.2 }),
        DEFAULT_THRESHOLDS,
        "widen",
      ),
    ).toBe("D_CONTEXT_ONLY");
  });

  test("幅1かつ中間帯・深い場合は既存の横の拡張（D_*）が発火し、補完先が曖昧なら沈黙する", () => {
    expect(
      decidePopup(
        makeResult({ elements: { emotion: 0.8, space: 0.25, time: 0.2 }, concreteDetail: 0.5 }),
      ),
    ).toBe("D_EMOTION_ONLY");
    expect(
      decidePopup(
        makeResult({ elements: { emotion: 0.8, space: 0.3, time: 0.1 }, concreteDetail: 0.5 }),
      ),
    ).toBeNull();
    expect(
      decidePopup(makeResult({ elements: { space: 0.75, sound: 0.2 }, concreteDetail: 0.7 })),
    ).toBe("D_CONTEXT_ONLY");
    expect(
      decidePopup(makeResult({ elements: { sound: 0.7, emotion: 0.2 }, concreteDetail: 0.7 })),
    ).toBe("D_SOUND_ONLY");
    expect(
      decidePopup(makeResult({ elements: { memory: 0.7, emotion: 0.2 }, concreteDetail: 0.7 })),
    ).toBe("D_MEMORY_ONLY");
    expect(
      decidePopup(makeResult({ elements: { sound: 0.7, emotion: 0.3 }, concreteDetail: 0.7 })),
    ).toBeNull();
  });
});
