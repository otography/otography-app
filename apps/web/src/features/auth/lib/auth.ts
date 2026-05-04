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
  console.info("requireAuth started.");
  const result = await getCurrentUser();

  if (result instanceof UnauthenticatedError) {
    console.info("requireAuth redirecting to /login.");
    redirect("/login");
  }
  if (result instanceof NoProfileError) {
    console.info("requireAuth redirecting to /setup-profile.");
    redirect("/setup-profile");
  }
  if (result instanceof Error) {
    console.error("requireAuth throwing unexpected error.", result);
    throw result;
  }

  console.info("requireAuth succeeded.");
  return result;
}

/**
 * 認証済みだがプロフィール未設定の状態を要求する（setup-profile用）。
 * 未認証 → /login、プロフィール既存 → /account へリダイレクト。
 */
export async function requireNoProfile() {
  console.info("requireNoProfile started.");
  const result = await getCurrentUser();

  if (result instanceof UnauthenticatedError) {
    console.info("requireNoProfile redirecting to /login.");
    redirect("/login");
  }
  if (result instanceof Error && !(result instanceof NoProfileError)) {
    console.error("requireNoProfile throwing unexpected error.", result);
    throw result;
  }
  // NoProfileError = 期待される状態 → そのまま表示
  if (!(result instanceof Error)) {
    console.info("requireNoProfile redirecting to /account.");
    redirect("/account");
  }
  console.info("requireNoProfile allowing setup-profile render.");
}
