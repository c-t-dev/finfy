import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { PATH_HEADER } from "./lib/next-path";

const intl = createMiddleware(routing);

/**
 * Public pages go through next-intl. Signed-in app pages only get their path
 * as a header, so the layout can send a visitor without a session to sign-in
 * and back (e.g. an invite link).
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, pathname);
    return NextResponse.next({ request: { headers } });
  }
  return intl(request);
}

export const config = {
  // Public pages and the signed-in app; skip the API, Next internals and files.
  matcher: ["/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)"],
};
