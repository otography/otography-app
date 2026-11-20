import { createContext, use } from "react";
import type { AssistPopupId } from "#/lib/draft-assist";
import type { AssistChip } from "./draft-assist-copy";

export interface ActiveAssistPopup {
  id: AssistPopupId;
  message: string;
  chips: ReadonlyArray<AssistChip>;
}

type DraftAssistState = {
  activePopup: ActiveAssistPopup | null;
  visible: boolean;
};

type DraftAssistActions = {
  dismiss: (method: "button" | "swipe") => void;
  applyChip: (chip: AssistChip) => void;
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
