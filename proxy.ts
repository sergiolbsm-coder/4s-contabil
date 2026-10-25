import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Checagem otimista (só presença do cookie); a validação real está em lib/session.ts
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (!request.cookies.get("session_token")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
