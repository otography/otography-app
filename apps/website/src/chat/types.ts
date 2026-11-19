import type { AppleSong } from "#/lib/musickit";

export type ChatTurn =
  | {
      id: string;
      kind: "user";
      song: AppleSong;
      content: string;
      createdAt: Date;
    }
  | {
      id: string;
      kind: "assistant";
      postId: string;
      songTitle: string;
      createdAt: Date;
    }
  | {
      id: string;
      kind: "assistant-error";
      message: string;
      createdAt: Date;
    };
