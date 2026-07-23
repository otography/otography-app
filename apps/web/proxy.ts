import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];
// APIパスはすべてNext.jsリライトでAPIサーバーに転送されるため、
// セッションチェックの対象外とする（OAuth コールバック等を含む）
const API_PREFIX = "/api/";

// 本番（HTTPS）と開発（localhost HTTP）で異なるCookie名を使用
const isSecureUrl = (url: URL) => url.protocol === "https:";
const getSessionCookieName = (isSecure: boolean) =>
  isSecure ? "__Host-otography_session" : "otography_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // パブリックパスはスキップ
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // APIパスはリライト先のAPIサーバーで処理されるためスキップ
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // オペークセッションCookieのみをチェック
  const isSecure = isSecureUrl(request.nextUrl);
  const sessionCookieName = getSessionCookieName(isSecure);
  const sessionCookie = request.cookies.get(sessionCookieName);
  if (!sessionCookie?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
