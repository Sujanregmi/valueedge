import { NextRequest, NextResponse } from "next/server";

// Must match COOKIE_NAME in app/dependencies.py on the backend.
const COOKIE_NAME = "edgepulse_session";

const PROTECTED_PREFIXES = [
  "/value-bets",
  "/portfolio",
  "/dashboard",
  "/arbitrage",
  "/sports",
  "/bankroll",
  "/bookmakers",
  "/my-bets",
  "/settings",
];

// Next.js 16 renamed middleware.ts -> proxy.ts, and the exported
// function itself from `middleware` to `proxy`. Same API otherwise
// (NextRequest, NextResponse, config.matcher all unchanged) -- the
// name is the only thing that matters here.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // This only checks that a cookie EXISTS -- it does not verify the
  // JWT signature or expiry. That's intentional: this is a UX layer
  // that avoids flashing a protected page before a redirect. The
  // real security boundary is get_current_user() on the backend,
  // which every protected API route depends on and which does
  // verify the token properly.
  const token = request.cookies.get(COOKIE_NAME);

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/value-bets/:path*",
    "/dashboard/:path*",
    "/portfolio/:path*",
    "/arbitrage/:path*",
    "/sports/:path*",
    "/bankroll/:path*",
    "/bookmakers/:path*",
    "/my-bets/:path*",
    "/settings/:path*",
  ],
};