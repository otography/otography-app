import { env } from "cloudflare:workers";
import { cert, initializeApp } from "@repo/firebase-auth-rest/app";
import { getAuth } from "@repo/firebase-auth-rest/auth";

const firebaseAuth = getAuth(
	initializeApp({
		credential: cert({
			clientEmail: env.FIREBASE_CLIENT_EMAIL,
			privateKey: env.FIREBASE_PRIVATE_KEY.replaceAll("\\n", "\n"),
			projectId: env.FIREBASE_PROJECT_ID,
		}),
		projectId: env.FIREBASE_PROJECT_ID,
	}),
);

export { firebaseAuth };
