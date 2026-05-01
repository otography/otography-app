import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { eq, sql } from "drizzle-orm";
import { RlsError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "./index";
import { users } from "./schema";

const abortRlsTransaction = (error: RlsError): never => {
  throw error;
};

const setupRlsTransaction = async (tx: DatabaseTransaction, jwtClaims: string) => {
  const claimsResult = await tx
    .execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`)
    .catch((e) => new RlsError({ message: "Failed to set JWT claims for RLS.", cause: e }));
  if (claimsResult instanceof Error) return claimsResult;

  const roleResult = await tx
    .execute(sql.raw("set local role authenticated"))
    .catch((e) => new RlsError({ message: "Failed to switch to 'authenticated' role.", cause: e }));
  if (roleResult instanceof Error) return roleResult;
};

export async function withRls<T>(
  claims: DecodedIdToken,
  fn: (tx: DatabaseTransaction, userId: string) => Promise<T>,
) {
  const firebaseId = typeof claims.sub === "string" ? claims.sub : null;
  if (!firebaseId) {
    return new RlsError({ message: "Missing user identifier in session." });
  }

  // Firebase ID → UUID 解決
  const db = createDb();
  const lookupResult = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseId, firebaseId))
    .limit(1)
    .catch((e) => new RlsError({ message: "Failed to resolve Firebase ID to UUID.", cause: e }));

  if (lookupResult instanceof RlsError) {
    return lookupResult;
  }

  const userRow = lookupResult[0];
  if (!userRow) {
    return new RlsError({ message: "User not found in database." });
  }

  const userId = userRow.id;
  const jwtClaims = JSON.stringify({ sub: userId });

  const result = await db
    .transaction(async (tx) => {
      const setupResult = await setupRlsTransaction(tx, jwtClaims);
      if (setupResult instanceof Error) abortRlsTransaction(setupResult);

      return await fn(tx, userId);
    })
    .catch((e) =>
      e instanceof RlsError ? e : new RlsError({ message: "Transaction failed.", cause: e }),
    );

  return result;
}
