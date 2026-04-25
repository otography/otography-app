import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { RlsError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "./index";

export async function withRls<T>(
  claims: DecodedIdToken,
  fn: (tx: DatabaseTransaction, userId: string) => Promise<T>,
) {
  // Custom Claims の db_uuid から UUID を取得
  const dbUuid = (claims as { db_uuid?: string }).db_uuid;
  if (typeof dbUuid !== "string" || dbUuid.length === 0) {
    return new RlsError({ message: "Missing db_uuid in session claims." });
  }

  const userId = dbUuid;
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

      return await fn(tx, userId);
    })
    .catch((e) =>
      e instanceof RlsError ? e : new RlsError({ message: "Transaction failed.", cause: e }),
    );

  return result;
}
