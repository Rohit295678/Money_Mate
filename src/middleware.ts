import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuth = Boolean(token);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthPage) {
    if (isAuth) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!isAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/register|_next/static|_next/image|favicon.ico).*)"],
};
