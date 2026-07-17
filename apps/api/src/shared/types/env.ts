import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import type { Database } from "../db";
import type { Bindings } from "./bindings";

export type Env = {
  Bindings: Bindings;
  Variables: {
    db: () => Database;
    authSession: DecodedIdToken | null;
  };
};
