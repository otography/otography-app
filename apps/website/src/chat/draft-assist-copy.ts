import type { AssistPopupId } from "#/lib/draft-assist";

export interface AssistChip {
  label: string;
  insertText: string;
}

export const ASSIST_POPUP_MESSAGES: Record<AssistPopupId, ReadonlyArray<string>> = {
  A_STALLED: [
    "この曲を聴いていたのは、どんな時間帯でしたか？",
    "再生したとき、目の前には何がありましたか？",
  ],
  B_ABSTRACT: [
    "特にどの瞬間（イントロ、歌詞、声など）でそう感じましたか？",
    "その気持ちを、少しだけ景色や温度に言い換えると？",
    "聴き終わったあと、気分はどう変わりましたか？",
  ],
  C_CRITIQUE: [
    "あなた自身の生活や記憶と重なる部分はありましたか？",
    "この曲を、どんな気分の日の自分に聴かせたいですか？",
    "誰かに渡すとしたら、どんな一言を添えますか？",
  ],
  D_EMOTION_ONLY: ["どんな場所や時間帯に聴くと、一番しっくりきそうですか？"],
  D_CONTEXT_ONLY: ["そのとき、曲のどの音や言葉が耳に残りましたか？"],
  D_SOUND_ONLY: ["そこを聴いて、どんな気持ちになりましたか？"],
  D_MEMORY_ONLY: ["今あらためて聴くと、当時と違う感じ方はありますか？"],
};

export const STALLED_CHIPS: ReadonlyArray<AssistChip> = [
  { label: "深夜に聴くと…", insertText: "深夜に聴くと" },
  { label: "帰り道に…", insertText: "帰り道に" },
  { label: "イントロの…", insertText: "イントロの" },
];

const lastPickedIndex = new Map<AssistPopupId, number>();

export function pickAssistMessage(
  popupId: AssistPopupId,
  random: () => number = Math.random,
): string {
  const candidates = ASSIST_POPUP_MESSAGES[popupId];
  if (candidates.length <= 1) {
    return candidates[0] ?? "";
  }

  const prev = lastPickedIndex.get(popupId);
  const availableIndices: Array<number> = [];
  for (let i = 0; i < candidates.length; i++) {
    if (i !== prev) {
      availableIndices.push(i);
    }
  }
  const chosen = availableIndices[Math.floor(random() * availableIndices.length)] ?? 0;
  lastPickedIndex.set(popupId, chosen);
  return candidates[chosen] ?? candidates[0] ?? "";
}

export function buildDraftWithChip(currentDraft: string, insertText: string): string {
  if (!currentDraft.trim()) {
    return insertText;
  }
  return `${currentDraft}${insertText}`;
}
