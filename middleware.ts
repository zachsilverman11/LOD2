import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Public routes that don't require authentication
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isWebhook = pathname.startsWith("/api/webhook");
  const isPublicApi = pathname.startsWith("/api/cron"); // Cron jobs
  const isAdminSeed = pathname === "/api/admin/seed-users"; // Temporary: seed users
  const isDebug = pathname.startsWith("/api/debug"); // Temporary: debug endpoints

  // Allow public routes
  if (isAuthRoute || isWebhook || isPublicApi || isAdminSeed || isDebug) {
    return;
  }

  // Redirect logged-in users away from login page
  if (isLoginPage && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Redirect unauthenticated users to login
  if (!isLoginPage && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
