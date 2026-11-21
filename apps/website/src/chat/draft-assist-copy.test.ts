import { describe, expect, test } from "vite-plus/test";
import {
  ASSIST_POPUP_MESSAGES,
  EMPTY_HINT_ANGLES,
  pickAssistMessage,
  pickEmptyPlaceholder,
} from "./draft-assist-copy";

describe("draft-assist-copy", () => {
  test("全11種別の動的ポップアップ文言と4観点の白紙ヒントが定義されている", () => {
    expect(Object.keys(ASSIST_POPUP_MESSAGES)).toEqual([
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
    ]);
    expect(ASSIST_POPUP_MESSAGES.E_DEEPEN_GENERAL).toHaveLength(3);
    expect(ASSIST_POPUP_MESSAGES.E_DEEPEN_MEMORY).toHaveLength(3);
    expect(ASSIST_POPUP_MESSAGES.E_DEEPEN_EMOTION).toHaveLength(4);
    expect(EMPTY_HINT_ANGLES.map((a) => a.id)).toEqual(["mood", "scene", "sound", "memory"]);
  });

  test("複数案がある ID では直近と異なる文言・角度・インデックスを優先して返す", () => {
    const first = pickAssistMessage("E_DEEPEN_EMOTION", () => 0);
    const second = pickAssistMessage("E_DEEPEN_EMOTION", () => 0);
    expect(first.index).not.toBe(second.index);
    expect(first.item.text).not.toBe(second.item.text);
    expect(first.item.angle).toBe("sensory");
  });

  test("白紙プレースホルダーは観点指定時に該当観点の例文を返し、現在値と異なるものを優先する", () => {
    const first = pickEmptyPlaceholder("scene", undefined, () => 0);
    const second = pickEmptyPlaceholder("scene", first, () => 0);
    expect(first).toBe("例：深夜の帰り道に聴きたくなる");
    expect(second).toBe("例：雨の日の朝に合う");
  });
});
