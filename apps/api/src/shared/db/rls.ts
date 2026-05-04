import type { DecodedIdToken } from "@repo/firebase-auth-rest/auth";
import { sql } from "drizzle-orm";
import { RlsError } from "@repo/errors";
import { createDb, type DatabaseTransaction } from "./index";

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

const setupAuthenticatedRole = async (tx: DatabaseTransaction) => {
  const roleResult = await tx
    .execute(sql.raw("set local role authenticated"))
    .catch((e) => new RlsError({ message: "Failed to switch to 'authenticated' role.", cause: e }));
  if (roleResult instanceof Error) return roleResult;
};

// SECURITY DEFINER 関数経由で Firebase ID → UUID 解決（postgres 権限で実行）
const resolveFirebaseId = async (firebaseId: string): Promise<string | RlsError> => {
  const db = createDb();
  const result = await db
    .execute<{ resolve_firebase_id: string | null }>(sql`select resolve_firebase_id(${firebaseId})`)
    .catch((e) => new RlsError({ message: "Failed to resolve Firebase ID to UUID.", cause: e }));

  if (result instanceof Error) return result;

  const userId = result[0]?.resolve_firebase_id;
  if (!userId) {
    return new RlsError({ message: "User not found in database." });
  }
  return userId;
};

// 認証済みユーザーとしてトランザクションを実行（JWT claims なし、ロールのみ authenticated）
export async function withAuthenticatedRole<T>(fn: (tx: DatabaseTransaction) => Promise<T>) {
  const db = createDb();
  const result = await db
    .transaction(async (tx) => {
      const setupResult = await setupAuthenticatedRole(tx);
      if (setupResult instanceof Error) abortRlsTransaction(setupResult);

      return await fn(tx);
    })
    .catch((e) =>
      e instanceof RlsError ? e : new RlsError({ message: "Transaction failed.", cause: e }),
    );

  return result;
}

export async function withRls<T>(
  claims: DecodedIdToken,
  fn: (tx: DatabaseTransaction, userId: string) => Promise<T>,
) {
  const firebaseId = typeof claims.sub === "string" ? claims.sub : null;
  if (!firebaseId) {
    return new RlsError({ message: "Missing user identifier in session." });
  }

  // SECURITY DEFINER 関数で Firebase ID → UUID 解決
  const userId = await resolveFirebaseId(firebaseId);
  if (userId instanceof Error) return userId;

  const jwtClaims = JSON.stringify({ sub: userId });
  const db = createDb();

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
