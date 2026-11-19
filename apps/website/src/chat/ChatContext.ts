import { createContext, use } from "react";
import type { TriggerMenuController } from "@ui-sdk/react/trigger-menu";
import type { AppleSong } from "#/lib/musickit";
import type { ChatTurn } from "./types";

type ChatState = {
  turns: ChatTurn[];
  selectedSong: AppleSong | null;
  draft: string;
  length: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  menuOpen: boolean;
};

type ChatActions = {
  selectSong: (song: AppleSong) => void;
  clearSong: () => void;
  updateDraft: (value: string) => void;
  setMenuOpen: (open: boolean) => void;
  submit: () => void;
};

type ChatMeta = {
  maxLength: number;
  menuController: TriggerMenuController;
};

export type ChatContextValue = {
  state: ChatState;
  actions: ChatActions;
  meta: ChatMeta;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const value = use(ChatContext);
  if (!value) throw new Error("useChat は ChatProvider の中で使う");
  return value;
}
