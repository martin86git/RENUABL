import { NextResponse, type NextRequest } from "next/server";
import { VIEWING_REFUSAL, VIEW_AS_COOKIE, passesWhileViewing } from "@/lib/domain/design/view-as";

/**
 * While the owner is viewing the product as someone else (domain/design/view-as.ts), the designer's API takes no
 * changes: anything but reading, or going back to their own view, is refused here, before any route runs.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(VIEW_AS_COOKIE)?.value && !passesWhileViewing(request.method, request.nextUrl.pathname))
    return NextResponse.json({ ok: false, message: VIEWING_REFUSAL }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/design/:path*" };
