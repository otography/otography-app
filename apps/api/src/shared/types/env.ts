import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import type { Database } from "../db";
import type { Bindings } from "./bindings";
import type { ResolvedSessionContext } from "../auth/session-model";

export type Env = {
  Bindings: Bindings;
  Variables: {
    db: () => Database;
    authSession: DecodedIdToken | null;
    sessionCtx: ResolvedSessionContext | null;
    authError: Error | null;
  };
};
