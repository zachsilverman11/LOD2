// Auth temporarily disabled for team access
// TODO: Re-enable auth when magic link login is working

import { NextResponse } from "next/server";

export function middleware() {
  // Allow all requests through without auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
