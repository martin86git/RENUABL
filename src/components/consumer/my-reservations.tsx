import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getMyReservations } from "@/lib/services/my-account";

/** For a signed-in customer: their reservations and where each is up to. */
export async function MyReservations() {
  const mine = await getMyReservations();
  if (!mine) return null;
  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-medium">Your reservation{mine.reservations.length > 1 ? "s" : ""}</h2>
        <form action="/api/auth/signout" method="post">
          <button className="tap-area relative text-[13px] text-muted underline underline-offset-4">Sign out {mine.email}</button>
        </form>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {mine.reservations.map((r) => (
          <li key={r.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="block text-[15px] text-ink">
                {r.reference} · {r.packageName}
              </span>
              <span className="block text-[13px] text-muted">
                {r.status}
                {r.partner ? ` · ${r.partner}` : ""}
                {r.installDate ? ` · ${formatDate(r.installDate, { weekday: "short", day: "numeric", month: "short" })}` : ""}
              </span>
            </span>
            <Link
              href={`/my/installation?record=${r.recordKey}`}
              className="flex items-center gap-1.5 text-[14px] text-ink underline underline-offset-4"
            >
              Installation record <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
