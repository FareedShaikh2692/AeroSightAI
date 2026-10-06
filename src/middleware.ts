import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Gate the application and admin areas. Fine-grained authorization happens server-side per request.
export async function middleware(req: NextRequest) {
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  if (!claims || (isAdmin && !claims.staff) || (!isAdmin && claims.staff)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = isAdmin ? "?staff=1" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };
