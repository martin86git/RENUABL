import type { ReactNode } from "react";
import { Badge, cn } from "@/components/ui/primitives";
import { stageLabel } from "@/lib/domain/job-status";
import type { JobStage } from "@/lib/domain/types";

// Green is reserved for confirmed / on-track / positive states only.
const STAGE_TONE: Record<JobStage, "positive" | "warning" | "info" | "neutral"> = {
  new: "info",
  accepted: "warning",
  scheduled: "positive",
  "in-progress": "info",
  completed: "neutral",
};

export function StageBadge({ stage }: { stage: JobStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{stageLabel(stage)}</Badge>;
}

export function Panel({
  className,
  title,
  action,
  children,
}: {
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight lg:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  positive = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("mt-2 text-[28px] font-semibold tracking-tight tabular-nums", positive && "text-positive")}>{value}</p>
      {detail && <p className="mt-1 text-[12px] text-muted">{detail}</p>}
    </div>
  );
}

export function ImageTile({ label }: { label: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "repeating-linear-gradient(135deg, transparent 0 14px, rgb(255 255 255 / 0.03) 14px 28px), radial-gradient(circle at 30% 30%, #2a3140, transparent 70%)",
        }}
      />
      <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">{label}</span>
    </div>
  );
}
