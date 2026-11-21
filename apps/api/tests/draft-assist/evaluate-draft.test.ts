import { describe, expect, test } from "vite-plus/test";
import type { DecisionModelAdapter } from "../../src/draft-assist/adapter.ts";
import { DecisionModelRequestError } from "../../src/draft-assist/errors.ts";
import { evaluateDraft } from "../../src/draft-assist/usecases/evaluate-draft.ts";
import type { DecisionLogEntry } from "../../src/draft-assist/usecases/evaluate-draft.ts";

describe("evaluateDraft", () => {
  test("正常時は判定結果を返し、concreteDetail を含む計測ログを記録する", async () => {
    const logs: Array<DecisionLogEntry> = [];
    const adapter: DecisionModelAdapter = {
      modelVersion: "clef-flash",
      evaluate: async () => ({
        modelVersion: "clef-flash",
        toneType: { choice: "abstract_only", confidence: 0.92 },
        elements: { space: 0.1, time: 0.1, sound: 0.1, memory: 0.1, emotion: 0.2 },
        concreteDetail: 0.12,
      }),
    };

    const res = await evaluateDraft({
      adapter,
      input: {
        draftSessionId: "sess-1",
        trackTitle: "曲名 - アーティスト",
        draftText: "すごくエモくて泣けた",
      },
      onLog: (entry) => logs.push(entry),
    });

    expect(res).toEqual({ popupId: "B_ABSTRACT", modelVersion: "clef-flash" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      event: "draft_assist_decision",
      draftSessionId: "sess-1",
      modelVersion: "clef-flash",
      concreteDetail: 0.12,
      decidedPopupId: "B_ABSTRACT",
    });
  });

  test("タイムアウト時はフェイルオープンで popupId: null を返す", async () => {
    const adapter: DecisionModelAdapter = {
      modelVersion: "clef-flash",
      evaluate: ({ signal }) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () =>
            resolve(new DecisionModelRequestError({ cause: "aborted" })),
          );
        }),
    };

    const res = await evaluateDraft({
      adapter,
      input: {
        draftSessionId: "sess-timeout",
        trackTitle: "曲名 - アーティスト",
        draftText: "すごく良い曲だった",
      },
      timeoutMs: 20,
    });

    expect(res).toEqual({ popupId: null, modelVersion: "clef-flash" });
  });

  test("モデルエラー時もフェイルオープンで popupId: null を返す", async () => {
    const adapter: DecisionModelAdapter = {
      modelVersion: "pplx-decider-flash-v1.3",
      evaluate: async () => new DecisionModelRequestError({ cause: new Error("503") }),
    };

    const res = await evaluateDraft({
      adapter,
      input: {
        draftSessionId: "sess-err",
        trackTitle: "曲名 - アーティスト",
        draftText: "すごく良い曲だった",
      },
    });

    expect(res).toEqual({ popupId: null, modelVersion: "pplx-decider-flash-v1.3" });
  });
});
