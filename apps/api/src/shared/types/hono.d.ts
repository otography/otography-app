import "hono";
import type { DecodedIdToken } from "firebase-admin/auth";

declare module "hono" {
	interface ContextVariableMap {
		authSession: DecodedIdToken | null;
	}
}
