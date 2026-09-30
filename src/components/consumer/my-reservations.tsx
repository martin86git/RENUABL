import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getMyReservations } from "@/lib/services/my-account";
import type { HealthPlan } from "@/lib/domain/home-health";
import { WHOOP_OFFER } from "@/lib/domain/whoop-offer";

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
              {r.forecast && <span className="mt-1 block text-[13px] text-ink-2">Install-day forecast: {r.forecast}</span>}
              {r.whoop && (
                <span className="mt-1 block text-[13px] text-forest">
                  Free {WHOOP_OFFER.product}: {r.whoop}
                  {r.whoop === "Reserved" ? " · ships after your installation" : ""}
                </span>
              )}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Link
                href={`/my/layout?record=${r.recordKey}`}
                className="flex items-center gap-1.5 text-[14px] text-ink underline underline-offset-4"
              >
                Panel layout <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/my/installation?record=${r.recordKey}`}
                className="flex items-center gap-1.5 text-[14px] text-ink underline underline-offset-4"
              >
                Installation record <ArrowRight className="h-4 w-4" />
              </Link>
            </span>
          </li>
        ))}
      </ul>
      <HealthCard health={mine.health} />
    </Card>
  );
}

/** "Complete your Home Health check" until it's done, then the saved plan. */
function HealthCard({ health }: { health: { plan: HealthPlan } | null }) {
  if (!health) {
    return (
      <Link href="/home-health" className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-sage px-5 py-4 text-forest">
        <span>
          <span className="block text-[15px]">Complete your Home Health check</span>
          <span className="block text-[13px]">A few quick questions about your air, water, comfort and sleep, with free tips.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={1.6} />
      </Link>
    );
  }
  return (
    <div className="mt-4 rounded-2xl bg-sage px-5 py-4 text-forest">
      <p className="text-[15px]">Your Home Health check</p>
      {health.plan.recommendations.length ? (
        <>
          <p className="mt-1 text-[13px]">Ideas worth looking into:</p>
          <ul className="mt-2 space-y-1 text-[13.5px]">
            {health.plan.recommendations.map((r) => (
              <li key={r.item}>{r.title}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-[13.5px]">Nothing stood out from your answers.</p>
      )}
      {health.plan.freeFixes[0] && <p className="mt-2 text-[13px]">Free fix: {health.plan.freeFixes[0].title}.</p>}
      <Link href="/home-health" className="tap-area mt-2 inline-block text-[13px] underline underline-offset-4">
        Update my answers
      </Link>
    </div>
  );
}
