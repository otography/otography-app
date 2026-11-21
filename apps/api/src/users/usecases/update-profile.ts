import type { z } from "zod";
import type { Database } from "../../lib/db.ts";
import { updateUser } from "../repository.ts";
import type { updateProfileInput } from "../schemas.ts";
import { getMe } from "./get-me.ts";

/** ログイン中のユーザーの表示名と自己紹介を変え、変えた後の自分の情報を返す。 */
export async function updateProfile({
  db,
  userId,
  input,
}: {
  db: Database;
  userId: string;
  input: z.output<typeof updateProfileInput>;
}) {
  const updated = await updateUser({ db, userId, values: input });
  if (updated instanceof Error) {
    return updated;
  }
  return getMe({ db, userId });
}
