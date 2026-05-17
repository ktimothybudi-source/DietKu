import { NextResponse } from "next/server";

const protectedPaths = ["/dashboard", "/earnings", "/leaderboard", "/settings"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("affiliate_session")?.value);

  if (protectedPaths.some((path) => pathname.startsWith(path)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/earnings/:path*", "/leaderboard/:path*", "/settings/:path*", "/login", "/signup"],
};
