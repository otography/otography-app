import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getBootEnv } from "../env";

const env = getBootEnv();

const firebaseAuth = getAuth(
	initializeApp({
		credential: cert({
			clientEmail: env.FIREBASE_CLIENT_EMAIL,
			privateKey: env.FIREBASE_PRIVATE_KEY,
			projectId: env.FIREBASE_PROJECT_ID,
		}),
		projectId: env.FIREBASE_PROJECT_ID,
	}),
);

export { firebaseAuth };
