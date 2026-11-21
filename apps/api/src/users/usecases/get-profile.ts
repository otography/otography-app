import type { Database } from "../../lib/db.ts";
import { ProfileOutputError, UserNotFoundError, UserQueryError } from "../errors.ts";
import { findProfileByPublicId, findUserById } from "../repository.ts";
import { profileOutput } from "../schemas.ts";

/** 公開 ID のユーザーのプロフィール（表示名、自己紹介、お気に入り）を返す。 */
export async function getProfile({ db, publicId }: { db: Database; publicId: string }) {
  const user = await findProfileByPublicId({ db, publicId });
  if (user instanceof Error) {
    return user;
  }
  if (!user) {
    return new UserNotFoundError({ publicId });
  }

  const profile = profileOutput.safeParse(user);
  if (!profile.success) {
    return new ProfileOutputError({ publicId, cause: profile.error });
  }
  return profile.data;
}

/** 内部 ID のユーザーのプロフィールを返す。お気に入りを変えた後に、変えた結果を返すために使う。 */
export async function getProfileOfUser({ db, userId }: { db: Database; userId: string }) {
  const user = await findUserById({ db, userId });
  if (user instanceof Error) {
    return user;
  }
  if (!user) {
    return new UserQueryError({ cause: new Error(`ユーザー ${userId} が DB にない`) });
  }
  return getProfile({ db, publicId: user.publicId });
}
