import "hono";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthErrorLike } from "../firebase-auth-error";

declare module "hono" {
	interface ContextVariableMap {
		authSession: {
			claims: DecodedIdToken;
			sessionCookie: string;
		} | null;
		authSessionError: AuthErrorLike | null;
		jwtPayload: DecodedIdToken | null;
		userId: string | null;
	}
}
