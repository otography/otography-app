import type { SessionUser } from "../../auth/session.ts";
import { MeResponseError } from "../errors.ts";
import { meSchema } from "../schemas.ts";

/** ログイン中のユーザー自身の情報を返す。内部 ID や利用停止・退会の日時は含めない。 */
export function getMe({ user }: { user: SessionUser }) {
  const me = meSchema.safeParse(user);
  if (!me.success) return new MeResponseError({ cause: me.error });
  return me.data;
}
