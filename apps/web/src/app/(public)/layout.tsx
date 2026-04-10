import { redirect } from "next/navigation";
import { NoProfileError, UnauthenticatedError } from "@repo/errors";
import { getCurrentUser } from "@/features/auth";

/**
 * 未認証ユーザー向けルートのUX最適化レイアウト。
 * 既に認証済みの場合は適切なページへリダイレクト。
 *
 * ⚠ セキュリティ境界ではない。各ページは単独でも動作すること。
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUser();

  if (!(result instanceof Error)) redirect("/");
  if (result instanceof NoProfileError) redirect("/setup-profile");
  if (result instanceof UnauthenticatedError) return <>{children}</>;
  throw result;
}
