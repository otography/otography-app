import { requireAuth } from "@/features/auth";

/**
 * 保護ルートのUX最適化レイアウト。
 * 未認証・プロフィール未設定の場合に早期リダイレクトする。
 *
 * ⚠ セキュリティ境界ではない。Next.jsのPartial Renderingにより、
 * レイアウトはバイパス可能（RSC=1ヘッダー）。
 * セキュリティは各ページの requireAuth() 呼び出しで保証する。
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
