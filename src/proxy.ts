import { NextResponse, type NextRequest } from "next/server";
import { VIEWING_REFUSAL, VIEW_AS_COOKIE, passesWhileViewing } from "@/lib/domain/design/view-as";
import { PATH_HEADER } from "@/lib/domain/design/business-kind";

/**
 * While the owner is viewing the product as someone else (domain/design/view-as.ts), the designer's API takes no
 * changes: anything but reading, or going back to their own view, is refused here, before any route runs. Every
 * request also carries the address asked for, for the check of what each kind of business may use.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(VIEW_AS_COOKIE)?.value && !passesWhileViewing(request.method, request.nextUrl.pathname))
    return NextResponse.json({ ok: false, message: VIEWING_REFUSAL }, { status: 403 });
  // The address asked for, for requireMember's check of what an installer's or inspector's login holds
  // (business-kind.ts). Set here, so a header sent by a browser is replaced, never believed.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/design/:path*" };
