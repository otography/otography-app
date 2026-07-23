import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import type { Database } from "../db";
import type { Bindings } from "./bindings";

// 認証ミドルウェアで解決済みのサーバーセッション情報
// sign-out / account-deletion がハッシュ再計算やDB再照会なしでセッションを特定するために使用
type ResolvedSessionContext = {
  sessionId: string;
  userId: string;
  version: number;
};

export type Env = {
  Bindings: Bindings;
  Variables: {
    db: () => Database;
    authSession: DecodedIdToken | null;
    sessionCtx: ResolvedSessionContext | null;
    authError: Error | null;
  };
};
