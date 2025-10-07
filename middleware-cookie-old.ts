import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check if accessing dashboard or analytics
  if (
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/dashboard/analytics")
  ) {
    // Check for session cookie
    const sessionCookie = request.cookies.get("lod2_session");

    if (!sessionCookie) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Validate session data exists
    try {
      const sessionData = JSON.parse(sessionCookie.value);
      if (!sessionData.username) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
