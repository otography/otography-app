import "hono";
import type { FirebaseAuthError, DecodedIdToken } from "firebase-admin/auth";

declare module "hono" {
	interface ContextVariableMap {
		authSession: {
			claims: DecodedIdToken;
			sessionCookie: string;
		} | null;
		authSessionError: FirebaseAuthError | null;
		jwtPayload: DecodedIdToken | null;
		userId: string | null;
	}
}
