import { cert, initializeApp } from "@repo/firebase-auth-rest/app";
import { getAuth } from "@repo/firebase-auth-rest/auth";

const firebaseAuth = getAuth(
	initializeApp({
		credential: cert({
			clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
			privateKey: process.env.FIREBASE_PRIVATE_KEY!.replaceAll("\\n", "\n"),
			projectId: process.env.FIREBASE_PROJECT_ID!,
		}),
		projectId: process.env.FIREBASE_PROJECT_ID!,
	}),
);

export { firebaseAuth };
