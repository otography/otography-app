import type { DecodedIdToken } from "firebase-admin/auth";
import { sql } from "drizzle-orm";
import type { Context } from "hono";
import { RlsError } from "@repo/errors";
import { getDb } from "./index";

type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function withRls<T>(
	c: Context,
	claims: DecodedIdToken,
	fn: (tx: DatabaseTransaction) => Promise<T>,
): Promise<RlsError | T> {
	const db = getDb(c);

	return db.transaction(async (tx) => {
		const userId = typeof claims.sub === "string" ? claims.sub : null;

		if (!userId) {
			return new RlsError({ message: "Missing user identifier in session." });
		}

		const jwtClaims = JSON.stringify({ sub: userId });

		const claimsResult = await tx
			.execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`)
			.catch(
				(e) =>
					new RlsError({
						message: "Failed to set JWT claims for RLS.",
						cause: e,
					}),
			);
		if (claimsResult instanceof Error) return claimsResult;

		const roleResult = await tx.execute(sql.raw("set local role authenticated")).catch(
			(e) =>
				new RlsError({
					message: "Failed to switch to 'authenticated' role.",
					cause: e,
				}),
		);
		if (roleResult instanceof Error) return roleResult;

		return fn(tx);
	});
}
