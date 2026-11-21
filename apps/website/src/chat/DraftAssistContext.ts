import { createContext, use } from "react";
import type { AssistMessageItem, AssistPopupId, EmptyHintAngle } from "#/lib/draft-assist";

export interface ActiveAssistPopup {
  id: AssistPopupId;
  messageIndex: number;
  item: AssistMessageItem;
}

type DraftAssistState = {
  activePopup: ActiveAssistPopup | null;
  visible: boolean;
  selectedAngle: EmptyHintAngle | null;
  placeholderText: string;
  showEmptyHints: boolean;
};

type DraftAssistActions = {
  dismiss: (method: "button" | "swipe") => void;
  selectEmptyHintAngle: (angle: EmptyHintAngle) => void;
};

export type DraftAssistContextValue = {
  state: DraftAssistState;
  actions: DraftAssistActions;
};

export const DraftAssistContext = createContext<DraftAssistContextValue | null>(null);

export function useDraftAssist() {
  const value = use(DraftAssistContext);
  if (!value) {
    throw new Error("useDraftAssist は DraftAssistProvider の中で使う");
  }
  return value;
}
