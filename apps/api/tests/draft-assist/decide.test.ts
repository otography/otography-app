import { describe, expect, test } from "vite-plus/test";
import { decidePopup, DEFAULT_THRESHOLDS, readThresholds } from "../../src/draft-assist/decide.ts";
import type { NormalizedDecisionResult } from "../../src/draft-assist/types.ts";

function makeResult(
  overrides: Partial<{
    toneType: NormalizedDecisionResult["toneType"];
    elements: Partial<NormalizedDecisionResult["elements"]>;
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
  };
}

describe("decidePopup", () => {
  test("2要素以上が明確に含まれていれば最優先で沈黙する", () => {
    const res = makeResult({
      toneType: { choice: "abstract_only", confidence: 0.95 },
      elements: { space: 0.7, sound: 0.65 },
    });
    expect(decidePopup(res)).toBeNull();
  });

  test("Choice の確信度が閾値以上なら B_ABSTRACT / C_CRITIQUE を返す", () => {
    expect(
      decidePopup(makeResult({ toneType: { choice: "abstract_only", confidence: 0.8 } })),
    ).toBe("B_ABSTRACT");
    expect(
      decidePopup(makeResult({ toneType: { choice: "objective_critique", confidence: 0.91 } })),
    ).toBe("C_CRITIQUE");
  });

  test("Choice の確信度が閾値未満、または personal_experience / other なら介入しない", () => {
    expect(
      decidePopup(makeResult({ toneType: { choice: "abstract_only", confidence: 0.79 } })),
    ).toBeNull();
    expect(
      decidePopup(makeResult({ toneType: { choice: "personal_experience", confidence: 0.95 } })),
    ).toBeNull();
    expect(decidePopup(makeResult({ toneType: { choice: "other", confidence: 0.95 } }))).toBeNull();
  });

  test("感情のみが明確で空間・時間が確実に欠けている場合は D_EMOTION_ONLY", () => {
    expect(decidePopup(makeResult({ elements: { emotion: 0.8, space: 0.25, time: 0.2 } }))).toBe(
      "D_EMOTION_ONLY",
    );
    expect(
      decidePopup(makeResult({ elements: { emotion: 0.8, space: 0.3, time: 0.1 } })),
    ).toBeNull();
  });

  test("空間または時間のみが明確で音が確実に欠けている場合は D_CONTEXT_ONLY", () => {
    expect(decidePopup(makeResult({ elements: { space: 0.75, sound: 0.2 } }))).toBe(
      "D_CONTEXT_ONLY",
    );
    expect(decidePopup(makeResult({ elements: { time: 0.75, sound: 0.25 } }))).toBe(
      "D_CONTEXT_ONLY",
    );
    expect(decidePopup(makeResult({ elements: { time: 0.75, sound: 0.4 } }))).toBeNull();
  });

  test("音のみ・記憶のみが明確で感情が確実に欠けている場合はそれぞれ D_SOUND_ONLY / D_MEMORY_ONLY", () => {
    expect(decidePopup(makeResult({ elements: { sound: 0.7, emotion: 0.2 } }))).toBe(
      "D_SOUND_ONLY",
    );
    expect(decidePopup(makeResult({ elements: { memory: 0.7, emotion: 0.2 } }))).toBe(
      "D_MEMORY_ONLY",
    );
    expect(decidePopup(makeResult({ elements: { sound: 0.7, emotion: 0.3 } }))).toBeNull();
  });
});

describe("readThresholds", () => {
  test("環境変数から閾値を読み込み、不正値はデフォルトにフォールバックする", () => {
    expect(readThresholds({})).toEqual(DEFAULT_THRESHOLDS);
    expect(
      readThresholds({
        DRAFT_ASSIST_CHOICE_CONFIDENCE: "0.85",
        DRAFT_ASSIST_ELEMENT_PRESENT: "0.7",
        DRAFT_ASSIST_ELEMENT_ABSENT: "0.2",
      }),
    ).toEqual({
      CHOICE_CONFIDENCE: 0.85,
      ELEMENT_PRESENT: 0.7,
      ELEMENT_ABSENT: 0.2,
    });
    expect(
      readThresholds({
        DRAFT_ASSIST_CHOICE_CONFIDENCE: "1.5",
        DRAFT_ASSIST_ELEMENT_PRESENT: "abc",
        DRAFT_ASSIST_ELEMENT_ABSENT: "-0.1",
      }),
    ).toEqual(DEFAULT_THRESHOLDS);
  });
});
