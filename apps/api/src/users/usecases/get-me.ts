import type { Database } from "../../lib/db.ts";
import { MeResponseError, UserQueryError } from "../errors.ts";
import { findUserById } from "../repository.ts";
import { meSchema } from "../schemas.ts";

/**
 * ログイン中のユーザー自身の情報を返す。内部 ID や利用停止・退会の日時は含めない。
 * セッションのクッキーキャッシュ（最大 5 分）ではなく DB から読むので、表示名を変えた直後でも新しい値を返す。
 */
export async function getMe({ db, userId }: { db: Database; userId: string }) {
  const user = await findUserById({ db, userId });
  if (user instanceof Error) return user;
  if (!user) return new UserQueryError({ cause: new Error(`ユーザー ${userId} が DB にない`) });

  const me = meSchema.safeParse(user);
  if (!me.success) return new MeResponseError({ cause: me.error });
  return me.data;
}
