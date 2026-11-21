import type { AssistPopupId } from "#/lib/draft-assist";

export interface AssistChip {
  label: string;
  insertText: string;
}

const DEEPEN_POPUP_MESSAGES: Record<
  | "E_DEEPEN_GENERAL"
  | "E_DEEPEN_CONTEXT"
  | "E_DEEPEN_SOUND"
  | "E_DEEPEN_MEMORY"
  | "E_DEEPEN_EMOTION",
  ReadonlyArray<string>
> = {
  // 幅2以上・浅い（①細分化 / ④作用・宛先）
  E_DEEPEN_GENERAL: [
    "そのときの景色や、特に耳に残った音をひとつ足すなら？",
    "この曲は、そのときの自分にどう寄り添ってくれましたか？",
    "同じような気分の誰かに渡すとしたら、どんな一言を添えますか？",
  ],
  // 時間・空間のみ・浅い（①細分化）
  E_DEEPEN_CONTEXT: [
    "どんな雰囲気の帰り道や時間帯でしたか？",
    "そのとき、目の前にはどんな景色がありましたか？",
  ],
  // 音のみ・浅い（①細分化 / ②質感）
  E_DEEPEN_SOUND: [
    "特にどの瞬間（イントロ、サビ、歌い出しなど）が引っかかりましたか？",
    "その音や声は、どんな感触・温度に近いですか？",
  ],
  // 記憶のみ・浅い（①細分化 / ③対比）
  E_DEEPEN_MEMORY: [
    "いつの頃の、どんな場面が浮かびましたか？",
    "今あらためて聴くと、当時と違う感じ方はありますか？",
  ],
  // 感情のみ・浅い（②質感 / ③変化 / ④作用）
  E_DEEPEN_EMOTION: [
    "その気持ちを、身体の感覚や温度にたとえると？",
    "聴く前と聴いたあとで、気分はどう変わりましたか？",
    "この曲は、その気持ちにどう寄り添ってくれましたか？",
  ],
};

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
  ...DEEPEN_POPUP_MESSAGES,
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
): { message: string; index: number } {
  const candidates = ASSIST_POPUP_MESSAGES[popupId];
  if (candidates.length <= 1) {
    return { message: candidates[0] ?? "", index: 0 };
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
  return { message: candidates[chosen] ?? candidates[0] ?? "", index: chosen };
}

export function buildDraftWithChip(currentDraft: string, insertText: string): string {
  if (!currentDraft.trim()) {
    return insertText;
  }
  return `${currentDraft}${insertText}`;
}
