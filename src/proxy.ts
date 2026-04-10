import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that don't require authentication
const publicRoutes = [
  "/dashboard/login",
  "/dashboard/stytch-authenticate",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublicRoute = publicRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");

  // Redirect logged-in users away from auth pages
  // Only redirect if user has a complete profile (tenant + company),
  // otherwise let them stay on auth pages to avoid infinite redirect loop
  if (isPublicRoute && isLoggedIn) {
    const hasCompleteProfile = !!req.auth?.user?.tenantId;
    if (hasCompleteProfile) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  // Redirect non-logged-in users to login
  if (isDashboardRoute && !isLoggedIn && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname);
    return NextResponse.redirect(
      new URL(`/dashboard/login?callbackUrl=${callbackUrl}`, nextUrl)
    );
  }

  // Add pathname header for server components to access
  const response = NextResponse.next();
  response.headers.set("x-pathname", nextUrl.pathname);
  return response;
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
