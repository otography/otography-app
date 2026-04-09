import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { RlsError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "./index";

export async function withRls<T>(
  claims: DecodedIdToken,
  fn: (tx: DatabaseTransaction) => Promise<T>,
) {
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  if (!userId) {
    return new RlsError({ message: "Missing user identifier in session." });
  }

  const jwtClaims = JSON.stringify({ sub: userId });

  const db = createDb();
  const result = await db
    .transaction(async (tx) => {
      await tx
        .execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`)
        .catch((e) => {
          throw new RlsError({ message: "Failed to set JWT claims for RLS.", cause: e });
        });

      await tx.execute(sql.raw("set local role authenticated")).catch((e) => {
        throw new RlsError({ message: "Failed to switch to 'authenticated' role.", cause: e });
      });

      return await fn(tx);
    })
    .catch((e) =>
      e instanceof RlsError ? e : new RlsError({ message: "Transaction failed.", cause: e }),
    );

  return result;
}
