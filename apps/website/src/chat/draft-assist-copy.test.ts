import { describe, expect, test } from "vite-plus/test";
import {
  ASSIST_POPUP_MESSAGES,
  buildDraftWithChip,
  pickAssistMessage,
  STALLED_CHIPS,
} from "./draft-assist-copy";

describe("draft-assist-copy", () => {
  test("全7種別のポップアップ文言と A_STALLED チップが定義されている", () => {
    expect(Object.keys(ASSIST_POPUP_MESSAGES)).toEqual([
      "A_STALLED",
      "B_ABSTRACT",
      "C_CRITIQUE",
      "D_EMOTION_ONLY",
      "D_CONTEXT_ONLY",
      "D_SOUND_ONLY",
      "D_MEMORY_ONLY",
    ]);
    expect(STALLED_CHIPS).toHaveLength(3);
  });

  test("複数案がある ID では直近と異なる文言を優先して返す", () => {
    const first = pickAssistMessage("A_STALLED", () => 0);
    const second = pickAssistMessage("A_STALLED", () => 0);
    expect(first).not.toBe(second);
  });

  test("チップ挿入は空ならそのまま、既存入力があれば末尾に続ける", () => {
    expect(buildDraftWithChip("", "深夜に聴くと")).toBe("深夜に聴くと");
    expect(buildDraftWithChip("   ", "帰り道に")).toBe("帰り道に");
    expect(buildDraftWithChip("雨の日の", "帰り道に")).toBe("雨の日の帰り道に");
  });
});
