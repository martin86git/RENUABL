import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PREVIEW_MODE } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/domain/accounts";

/** Preview only: opens the partner portal with sample data, without an account. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!PREVIEW_MODE) return NextResponse.redirect(new URL("/login?as=partner", origin));
  (await cookies()).set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86_400 });
  return NextResponse.redirect(new URL("/installer", origin));
}
