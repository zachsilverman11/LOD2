import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Only protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const basicAuth = request.headers.get("authorization");
    const url = request.nextUrl;

    if (basicAuth) {
      const authValue = basicAuth.split(" ")[1];
      const [user, pwd] = atob(authValue).split(":");

      const validUser = process.env.BASIC_AUTH_USER || "admin";
      const validPass = process.env.BASIC_AUTH_PASSWORD || "InspiredMortgage2025!";

      if (user === validUser && pwd === validPass) {
        return NextResponse.next();
      }
    }

    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
