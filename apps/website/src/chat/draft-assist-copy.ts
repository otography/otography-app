import type { AssistMessageItem, AssistPopupId, EmptyHintAngle } from "#/lib/draft-assist";

interface EmptyHintAngleItem {
  id: EmptyHintAngle;
  label: string;
  examples: ReadonlyArray<string>;
}

export const EMPTY_HINT_ANGLES: ReadonlyArray<EmptyHintAngleItem> = [
  {
    id: "mood",
    label: "今の気分",
    examples: ["例：なんか落ち着く、ずっと聴いていられる", "例：ちょっと疲れた日にちょうどいい"],
  },
  {
    id: "scene",
    label: "時間・場所",
    examples: ["例：深夜の帰り道に聴きたくなる", "例：雨の日の朝に合う"],
  },
  {
    id: "sound",
    label: "耳に残った音",
    examples: ["例：イントロのギターが好き", "例：サビの歌詞でちょっと泣きそうになった"],
  },
  {
    id: "memory",
    label: "思い出したこと",
    examples: ["例：学生の頃の夏を思い出した", "例：昔よく歩いていた道を思い出す"],
  },
];

export const ASSIST_POPUP_MESSAGES: Record<AssistPopupId, ReadonlyArray<AssistMessageItem>> = {
  // 幅0・抽象語のみ（※内省的Whyは直感段階に負荷が高いため入れない）
  B_ABSTRACT: [
    { angle: "zoom_in", text: "特にどの瞬間（イントロ、歌詞、声など）でそう感じましたか？" },
    { angle: "sensory", text: "その気持ちを、少しだけ景色や温度に言い換えると？" },
    { angle: "contrast", text: "聴き終わったあと、気分はどう変わりましたか？" },
  ],

  // 軸のズレ（客観評価・批評寄り）
  C_CRITIQUE: [
    { angle: "reframe_self", text: "あなた自身の生活や記憶と重なる部分はありましたか？" },
    { angle: "reframe_self", text: "この曲を、どんな気分の日の自分に聴かせたいですか？" },
    { angle: "role_or_who", text: "誰かに渡すとしたら、どんな一言を添えますか？" },
  ],

  // 横の拡張（幅1・深い or 中間帯）
  D_EMOTION_ONLY: [
    { angle: "widen_dimension", text: "どんな場所や時間帯に聴くと、一番しっくりきそうですか？" },
  ],
  D_CONTEXT_ONLY: [
    { angle: "widen_dimension", text: "そのとき、曲のどの音や言葉が耳に残りましたか？" },
  ],
  D_SOUND_ONLY: [{ angle: "widen_dimension", text: "そこを聴いて、どんな気持ちになりましたか？" }],
  D_MEMORY_ONLY: [
    { angle: "contrast", text: "今あらためて聴くと、当時と違う感じ方はありますか？" },
  ],

  // 縦の深掘り（幅2以上・浅い）
  E_DEEPEN_GENERAL: [
    { angle: "zoom_in", text: "そのときの景色や、特に耳に残った音をひとつ足すなら？" },
    { angle: "role_or_who", text: "同じような気分の誰かに渡すとしたら、どんな一言を添えますか？" },
    {
      angle: "reflective_why",
      text: "今の自分の状況や最近の出来事と、どこか重なる部分がありましたか？",
    },
  ],

  // 縦の深掘り（幅1・浅い）
  E_DEEPEN_CONTEXT: [
    { angle: "zoom_in", text: "どんな雰囲気の帰り道や時間帯でしたか？" },
    { angle: "zoom_in", text: "そのとき、目の前にはどんな景色がありましたか？" },
  ],
  E_DEEPEN_SOUND: [
    {
      angle: "zoom_in",
      text: "特にどの瞬間（イントロ、サビ、歌い出しなど）が引っかかりましたか？",
    },
    { angle: "sensory", text: "その音や声は、どんな感触・温度に近いですか？" },
  ],
  E_DEEPEN_MEMORY: [
    { angle: "zoom_in", text: "いつの頃の、どんな場面が浮かびましたか？" },
    { angle: "contrast", text: "今あらためて聴くと、当時と違う感じ方はありますか？" },
    { angle: "role_or_who", text: "その記憶の中で、誰かの顔や言葉は浮かびましたか？" },
  ],
  E_DEEPEN_EMOTION: [
    { angle: "sensory", text: "その気持ちを、身体の感覚や温度にたとえると？" },
    { angle: "contrast", text: "聴く前と聴いたあとで、気分はどう変わりましたか？" },
    { angle: "role_or_who", text: "この曲は、その気持ちにどう寄り添ってくれましたか？" },
    {
      angle: "reflective_why",
      text: "今の自分の状況や気分と、どこか重なる部分がありましたか？",
    },
  ],
};

const ALL_EMPTY_EXAMPLES = EMPTY_HINT_ANGLES.flatMap((item) => item.examples);
const lastPickedIndex = new Map<AssistPopupId, number>();

export function pickEmptyPlaceholder(
  angle: EmptyHintAngle | null,
  currentPlaceholder?: string,
  random: () => number = Math.random,
): string {
  const pool =
    angle === null
      ? ALL_EMPTY_EXAMPLES
      : (EMPTY_HINT_ANGLES.find((item) => item.id === angle)?.examples ?? ALL_EMPTY_EXAMPLES);

  const candidates =
    currentPlaceholder && pool.length > 1
      ? pool.filter((example) => example !== currentPlaceholder)
      : pool;

  return candidates[Math.floor(random() * candidates.length)] ?? pool[0] ?? "";
}

export function pickAssistMessage(
  popupId: AssistPopupId,
  random: () => number = Math.random,
): { item: AssistMessageItem; index: number } {
  const candidates = ASSIST_POPUP_MESSAGES[popupId];
  const fallback: AssistMessageItem = candidates[0] ?? { angle: "zoom_in", text: "" };
  if (candidates.length <= 1) {
    return { item: fallback, index: 0 };
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
  return { item: candidates[chosen] ?? fallback, index: chosen };
}
