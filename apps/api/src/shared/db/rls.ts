import type { DecodedIdToken } from "firebase-admin/auth";
import { sql } from "drizzle-orm";
import type { Context } from "hono";
import { getDb } from "./index";

type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function withRls<T>(
	c: Context,
	claims: DecodedIdToken,
	fn: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
	const db = getDb(c);

	return db.transaction(async (tx) => {
		const userId = typeof claims.sub === "string" ? claims.sub : null;

		if (!userId) {
			throw new Error("Missing sub claim in Firebase session cookie.");
		}

		const jwtClaims = JSON.stringify({ sub: userId });

		await tx.execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`);

		try {
			await tx.execute(sql.raw("set local role authenticated"));
		} catch (error) {
			throw new Error(
				"Failed to switch to 'authenticated' role. Ensure the database user in DATABASE_URL is a member of the 'authenticated' role (run: GRANT authenticated TO <db_user>;).",
				{ cause: error },
			);
		}

		return fn(tx);
	});
}
