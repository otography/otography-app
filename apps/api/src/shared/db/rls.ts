import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { eq, sql } from "drizzle-orm";
import { RlsError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "./index";
import { users } from "./schema";

export async function withRls<T>(
  claims: DecodedIdToken,
  fn: (tx: DatabaseTransaction, userId: string) => Promise<T>,
) {
  const firebaseId = typeof claims.sub === "string" ? claims.sub : null;
  if (!firebaseId) {
    return new RlsError({ message: "Missing user identifier in session." });
  }

  // Custom Claims の db_uuid を優先使用
  let userId: string;
  const dbUuid = (claims as { db_uuid?: string }).db_uuid;

  if (typeof dbUuid === "string" && dbUuid.length > 0) {
    // Custom Claims に db_uuid があれば直接使用（DB ルックアップなし）
    userId = dbUuid;
  } else {
    // フォールバック: Firebase ID → UUID ルックアップ
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
    userId = userRow.id;
  }

  const jwtClaims = JSON.stringify({ sub: userId });
  const db = createDb();

  const result = await db
    .transaction(async (tx) => {
      await tx.execute(sql`select set_config('request.jwt.claims', ${jwtClaims}, true)`);
      await tx.execute(sql.raw("set local role authenticated"));
      return await fn(tx, userId);
    })
    .catch((e) =>
      e instanceof RlsError ? e : new RlsError({ message: "Transaction failed.", cause: e }),
    );

  return result;
}
