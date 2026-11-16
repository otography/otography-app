import type { Database } from "../../lib/db.ts";
import { ProfileOutputError, UserNotFoundError } from "../errors.ts";
import { findProfileByPublicId } from "../repository.ts";
import { profileOutput } from "../schemas.ts";

/** 公開 ID のユーザーのプロフィール（表示名、自己紹介、お気に入り）を返す。 */
export async function getProfile({ db, publicId }: { db: Database; publicId: string }) {
  const user = await findProfileByPublicId({ db, publicId });
  if (user instanceof Error) return user;
  if (!user) return new UserNotFoundError({ publicId });

  const profile = profileOutput.safeParse(user);
  if (!profile.success) return new ProfileOutputError({ publicId, cause: profile.error });
  return profile.data;
}
