import "hono";
import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";

declare module "hono" {
	interface ContextVariableMap {
		authSession: DecodedIdToken | null;
	}
}
