import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "api/auth-cookies";

const PUBLIC_PATHS = ["/login", "/signup"];
// APIパスはすべてNext.jsリライトでAPIサーバーに転送されるため、
// セッションチェックの対象外とする（OAuth コールバック等を含む）
const API_PREFIX = "/api/";

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

  // セッションクッキーがなくても refresh token があれば API 側の自動更新に任せる
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const refreshTokenCookie = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME);
  if (!sessionCookie?.value && !refreshTokenCookie?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
