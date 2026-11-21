import { createContext, use } from "react";
import type { AppleSong } from "#/lib/musickit";
import type { PostDateGroup } from "./history-groups";

type CatalogSongLookup = {
  byId: Map<string, AppleSong>;
  byIsrc: Map<string, AppleSong>;
};

type ChatHistoryState = {
  groups: Array<PostDateGroup>;
  totalCount: number;
  catalogSongs: CatalogSongLookup;
  isPending: boolean;
  error: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isDesktop: boolean;
  desktopOpen: boolean;
  mobileOpen: boolean;
};

type ChatHistoryActions = {
  fetchNextPage: () => void;
  setDesktopOpen: (open: boolean) => void;
  toggleDesktop: () => void;
  setMobileOpen: (open: boolean) => void;
};

export type ChatHistoryContextValue = {
  state: ChatHistoryState;
  actions: ChatHistoryActions;
};

export const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

export function useChatHistory() {
  const value = use(ChatHistoryContext);
  if (!value) {
    throw new Error("useChatHistory は ChatHistoryProvider の中で使う");
  }
  return value;
}
