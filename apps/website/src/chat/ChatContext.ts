import { createContext, use } from "react";
import type { RefObject } from "react";
import type { AppleSong } from "#/lib/musickit";
import type { ChatTurn } from "./types";

export type SongSearchTrigger = "@" | "/";

type ChatState = {
  turns: Array<ChatTurn>;
  selectedSong: AppleSong | null;
  draft: string;
  length: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  isComposing: boolean;
  lastSubmission: { id: string; length: number } | null;
  searchTrigger: SongSearchTrigger | null;
  searchQuery: string;
  menuOpen: boolean;
  keyboardOpen: boolean;
  songs: Array<AppleSong>;
  songsLoading: boolean;
  highlightedIndex: number;
};

type ChatActions = {
  selectSong: (song: AppleSong) => void;
  clearSong: () => void;
  updateDraft: (value: string) => void;
  setComposing: (composing: boolean) => void;
  openSongSearch: (trigger: SongSearchTrigger) => void;
  dismissSongSearch: () => void;
  submit: () => void;
  setKeyboardOpen: (open: boolean) => void;
  highlightSong: (index: number) => void;
  moveHighlight: (direction: -1 | 1) => void;
  registerTextarea: (el: HTMLTextAreaElement | null) => void;
  registerComposer: (el: HTMLFormElement | null) => void;
};

type ChatMeta = {
  maxLength: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  composerRef: RefObject<HTMLFormElement | null>;
  pickerId: string;
};

export type ChatContextValue = {
  state: ChatState;
  actions: ChatActions;
  meta: ChatMeta;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const value = use(ChatContext);
  if (!value) {
    throw new Error("useChat は ChatProvider の中で使う");
  }
  return value;
}
