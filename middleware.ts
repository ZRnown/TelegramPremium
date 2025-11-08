import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")
  const isLoginPage = request.nextUrl.pathname === "/login"
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard")
  const isApiAuth = request.nextUrl.pathname.startsWith("/api/auth")

  // Allow API auth routes
  if (isApiAuth) {
    return NextResponse.next()
  }

  // Redirect to dashboard if logged in and trying to access login page
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect to login if trying to access dashboard without session
  if (isDashboard && !session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/auth/:path*"],
}
