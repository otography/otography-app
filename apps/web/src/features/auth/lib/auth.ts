import { redirect } from "next/navigation";
import { NoProfileError, UnauthenticatedError } from "@repo/errors";
import { getCurrentUser } from "./current-user";

/**
 * 認証済み＋プロフィール設定済みを要求する。
 * 未認証 → /login、プロフィール未設定 → /setup-profile へリダイレクト。
 * 戻り値は型安全なユーザーオブジェクト（Error型の可能性なし）。
 *
 * ※ React.cache() により、同一レンダー内でレイアウトとページの両方から
 *    呼び出してもAPI呼び出しは1回のみ。
 */
export async function requireAuth() {
  const result = await getCurrentUser();

  if (result instanceof UnauthenticatedError) redirect("/login");
  if (result instanceof NoProfileError) redirect("/setup-profile");
  if (result instanceof Error) throw result;

  return result;
}

/**
 * 認証済みだがプロフィール未設定の状態を要求する（setup-profile用）。
 * 未認証 → /login、プロフィール既存 → /account へリダイレクト。
 */
export async function requireNoProfile() {
  const result = await getCurrentUser();

  if (result instanceof UnauthenticatedError) redirect("/login");
  if (result instanceof Error && !(result instanceof NoProfileError)) throw result;
  // NoProfileError = 期待される状態 → そのまま表示
  if (!(result instanceof Error)) redirect("/account");
}
