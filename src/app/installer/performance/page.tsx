import { Metric, PageHeader, Panel } from "@/components/installer/bits";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { getPerformance } from "@/lib/services/installer";

export const metadata = { title: "Performance" };

export default function PerformancePage() {
  const p = getPerformance();
  const max = Math.max(...p.trend.map((t) => t.jobs));

  return (
    <>
      <PageHeader title="Performance" subtitle="The metrics that drive your matching priority on RENUABL" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 lg:gap-4">
        <Metric
          label="Jobs completed"
          value={p.jobsCompletedThisMonth}
          detail={`${p.jobsCompletedLastMonth} last month`}
          positive={p.jobsCompletedThisMonth >= p.jobsCompletedLastMonth}
        />
        <Metric label="On-time rate" value={formatPercent(p.onTimeRate)} detail="Target 95%" positive={p.onTimeRate >= 0.95} />
        <Metric
          label="First-time pass"
          value={formatPercent(p.firstTimePassRate)}
          detail={`Defect rate ${formatPercent(p.defectRate)}`}
          positive={p.firstTimePassRate >= 0.95}
        />
        <Metric label="Customer rating" value={p.customerRating.toFixed(1)} detail="Last 90 days" positive={p.customerRating >= 4.8} />
        <Metric label="Response time" value={`${p.medianResponseHours}h`} detail="Median to new jobs" />
        <Metric label="Payouts" value={formatCurrency(p.payoutsThisMonth)} detail={`${formatCurrency(p.pendingPayouts)} pending`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Panel title="Completed jobs · last 6 months" className="lg:col-span-8">
          <div className="flex h-56 items-end gap-4 p-6" role="img" aria-label="Completed jobs per month">
            {p.trend.map((t, i) => (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[12px] tabular-nums text-muted">{t.jobs}</span>
                <div
                  className={
                    i === p.trend.length - 1 ? "w-full max-w-12 rounded-lg bg-positive" : "w-full max-w-12 rounded-lg bg-line-strong"
                  }
                  style={{ height: `${(t.jobs / max) * 150}px` }}
                />
                <span className="text-[12px] text-muted">{t.label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="How matching works" className="lg:col-span-4">
          <div className="space-y-3 p-5 text-[14px] leading-relaxed text-ink-2">
            <p>RENUABL matches customers to one installer by default. Your priority is weighted by:</p>
            <ul className="space-y-1.5 text-muted">
              <li>• Customer rating — 30%</li>
              <li>• On-time arrival — 25%</li>
              <li>• First-time pass — 25%</li>
              <li>• Experience & capacity — 20%</li>
            </ul>
            <p>Fast responses to new jobs keep your availability visible to customers.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
