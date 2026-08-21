import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ROUTES = ["/auth/sign-in", "/auth/sign-up"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // CORS preflight handling for /api/ routes
  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": appUrl,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, x-admin-token",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Add deprecation header for unversioned API routes
    if (!pathname.startsWith("/api/v1/") && !pathname.startsWith("/api/openapi.json")) {
      const response = NextResponse.next();
      response.headers.set("Deprecation", "true");
      response.headers.set("Link", '</api/v1>; rel="successor-version"');
      return response;
    }

    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const sessionToken = request.cookies.get("better-auth.session_token");

  if (isProtected && !sessionToken) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signIn);
  }

  if (AUTH_ROUTES.includes(pathname) && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
