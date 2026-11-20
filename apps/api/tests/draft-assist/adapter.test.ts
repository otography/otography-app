import { describe, expect, test } from "vite-plus/test";
import {
  CLEF_FLASH_WORKERS_AI_MODEL,
  createClefFlashAdapter,
  createSystemOneHttpAdapter,
  normalizeSystemOneResponse,
  PPLX_DECIDER_MODEL_VERSION,
  resolveDecisionAdapter,
} from "../../src/draft-assist/adapter.ts";
import {
  DecisionModelConfigError,
  DecisionModelParseError,
} from "../../src/draft-assist/errors.ts";

describe("normalizeSystemOneResponse", () => {
  test("System One 標準形式（probabilities + noul）を正規化できる", () => {
    const result = normalizeSystemOneResponse(
      {
        model: "pplx-decider-flash-v1.3",
        answers: {
          tone_type: {
            probabilities: {
              abstract_only: 0.88,
              objective_critique: 0.05,
              personal_experience: 0.04,
              other: 0.03,
            },
          },
          has_space: { noul: 0.12 },
          has_time: { noul: 0.08 },
          has_sound: { noul: 0.2 },
          has_memory: { noul: 0.05 },
          has_emotion_or_action: { noul: 0.72 },
        },
      },
      "fallback",
    );

    expect(result).toEqual({
      modelVersion: "pplx-decider-flash-v1.3",
      toneType: { choice: "abstract_only", confidence: 0.88 },
      elements: { space: 0.12, time: 0.08, sound: 0.2, memory: 0.05, emotion: 0.72 },
    });
  });

  test("choice/confidence 直接形式と数値 noul を正規化できる", () => {
    const result = normalizeSystemOneResponse(
      {
        answers: {
          tone_type: { choice: "objective_critique", confidence: 0.91 },
          has_space: 0.1,
          has_time: 0.2,
          has_sound: 0.3,
          has_memory: 0.0,
          has_emotion_or_action: 0.15,
        },
      },
      "clef-flash",
    );

    expect(result).toEqual({
      modelVersion: "clef-flash",
      toneType: { choice: "objective_critique", confidence: 0.91 },
      elements: { space: 0.1, time: 0.2, sound: 0.3, memory: 0.0, emotion: 0.15 },
    });
  });

  test("必須フィールド欠損時は DecisionModelParseError を返す", () => {
    const result = normalizeSystemOneResponse({ answers: {} }, "clef-flash");
    expect(result).toBeInstanceOf(DecisionModelParseError);
  });
});

describe("resolveDecisionAdapter & adapters", () => {
  test("デフォルトは clef-flash を選び Workers AI へ System One ペイロードを送る", async () => {
    const captured: { model: string; payload?: Record<string, unknown> } = { model: "" };

    const adapter = resolveDecisionAdapter({
      env: {},
      runAi: async (model, payload) => {
        captured.model = model;
        captured.payload = payload;
        return {
          answers: {
            tone_type: { choice: "abstract_only", confidence: 0.9 },
            has_space: { noul: 0.1 },
            has_time: { noul: 0.1 },
            has_sound: { noul: 0.1 },
            has_memory: { noul: 0.1 },
            has_emotion_or_action: { noul: 0.1 },
          },
        };
      },
    });

    expect(adapter).not.toBeInstanceOf(Error);
    if (adapter instanceof Error) {
      return;
    }

    const res = await adapter.evaluate({
      trackTitle: "夜に駆ける - YOASOBI",
      draftText: "めっちゃエモい",
    });
    expect(captured.model).toBe(CLEF_FLASH_WORKERS_AI_MODEL);
    expect(captured.payload?.state).toEqual({
      track_title: "夜に駆ける - YOASOBI",
      draft_text: "めっちゃエモい",
    });
    expect(res).not.toBeInstanceOf(Error);
  });

  test("DRAFT_ASSIST_PROVIDER=pplx-decider で HTTP アダプタに切り替わる", async () => {
    const adapter = resolveDecisionAdapter({
      env: {
        DRAFT_ASSIST_PROVIDER: "pplx-decider",
        DRAFT_ASSIST_API_URL: "https://example.test/v1/systemone",
        DRAFT_ASSIST_API_KEY: "test-key",
      },
      fetchImpl: async () =>
        Response.json({
          model: PPLX_DECIDER_MODEL_VERSION,
          answers: {
            tone_type: { choice: "personal_experience", confidence: 0.9 },
            has_space: { noul: 0.8 },
            has_time: { noul: 0.8 },
            has_sound: { noul: 0.1 },
            has_memory: { noul: 0.1 },
            has_emotion_or_action: { noul: 0.1 },
          },
        }),
    });

    expect(adapter).not.toBeInstanceOf(Error);
    if (adapter instanceof Error) {
      return;
    }
    expect(adapter.modelVersion).toBe(PPLX_DECIDER_MODEL_VERSION);

    const res = await adapter.evaluate({
      trackTitle: "曲名 - アーティスト",
      draftText: "深夜の帰り道に聴いた",
    });
    expect(res).not.toBeInstanceOf(Error);
  });

  test("pplx-decider で URL 未設定なら DecisionModelConfigError を返す", () => {
    const adapter = resolveDecisionAdapter({
      env: { DRAFT_ASSIST_PROVIDER: "pplx-decider" },
    });
    expect(adapter).toBeInstanceOf(DecisionModelConfigError);
  });

  test("HTTP エラー時は Error 値として返す", async () => {
    const adapter = createSystemOneHttpAdapter({
      endpoint: "https://example.test/v1/systemone",
      modelVersion: PPLX_DECIDER_MODEL_VERSION,
      fetchImpl: async () => new Response("rate limited", { status: 429 }),
    });
    const res = await adapter.evaluate({ trackTitle: "a", draftText: "b" });
    expect(res).toBeInstanceOf(Error);
  });

  test("Clef-flash の例外も Error 値に変換される", async () => {
    const adapter = createClefFlashAdapter({
      runAi: async () => {
        throw new Error("quota exceeded");
      },
    });
    const res = await adapter.evaluate({ trackTitle: "a", draftText: "b" });
    expect(res).toBeInstanceOf(Error);
  });
});
