"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { setPipelines } from "@/lib/domain/design/deal";
import { pipelinesFor, stageName, type KeptPipeline, type OwnStage, type StageNames } from "@/lib/domain/design/pipeline-stages";
import { listPipelines, saveWonLeavesSales } from "@/lib/services/crm";
import { PATHS, ui } from "./design-shell";

/**
 * Settings → Pipeline automations: what a deal does by itself as it moves through the pipelines. One for now: a deal
 * won (marked so, or its proposal signed) leaves the Sales pipeline for Post sale. On unless the business switches it
 * off, which keeps Won as the Sales pipeline's last column. A Sales pipeline the business has changed on Deals keeps
 * the stages it was given, whatever the switch says.
 */
export function PipelineSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const [book, setBook] = useState<{ kept: KeptPipeline[]; own: OwnStage[]; names: StageNames }>({ kept: [], own: [], names: {} });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void listPipelines().then((res) => {
      if (!res.ok) return setStatus({ ok: false, text: res.message });
      setOn(res.wonLeavesSales !== false);
      setBook({ kept: res.pipelines, own: res.stages, names: res.names ?? {} });
    });
  }, []);
  const flip = async () => {
    if (on === null) return;
    const next = !on;
    setOn(next);
    const res = await saveWonLeavesSales(next);
    if (!res.ok) {
      setOn(!next);
      return setStatus({ ok: false, text: res.message });
    }
    setOn(res.wonLeavesSales);
    setStatus({
      ok: true,
      text: res.wonLeavesSales ? "Saved. A deal won now leaves the Sales pipeline." : "Saved. A deal won now stays in the Sales pipeline.",
    });
  };
  // The Sales pipeline as the business will see it on Deals with the switch as it stands.
  const all = pipelinesFor(book.kept, book.own, setPipelines(on !== false));
  const sales = all[0];
  const to = sales.next ? all.find((p) => p.id === sales.next?.to) : undefined;
  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Pipeline automations</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">What a deal does by itself as it moves through your pipelines.</p>
      <div className={clsx(ui.card, "mt-6 p-5")}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium text-ink">A deal won moves to the Post sale pipeline</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              When a deal is marked won, or its proposal is signed, it leaves the Sales pipeline and shows in the Post sale pipeline. Switch
              it off to keep Won as the last column of the Sales pipeline too.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on === true}
            disabled={on === null}
            onClick={() => void flip()}
            className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-sun-line" : "bg-line-strong")}
          >
            <span className="sr-only">A deal won moves to the Post sale pipeline</span>
            <span className={clsx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
          </button>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-muted">Your {sales.name}</p>
        <ol className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink">
          {sales.stages.map((stage, i) => (
            <li key={stage} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="size-3.5 text-muted" aria-hidden />}
              <span className="rounded-md bg-surface-2 px-2.5 py-1.5">{stageName(stage, book.own, book.names)}</span>
            </li>
          ))}
          {sales.next && (
            <li className="flex items-center gap-2">
              <ArrowRight className="size-3.5 text-muted" aria-hidden />
              <span className="rounded-md border border-dashed border-line-strong px-2.5 py-1.5 text-ink-2">
                {stageName(sales.next.at, book.own, book.names)}: moves to {to?.name ?? "Post sale"}
              </span>
            </li>
          )}
        </ol>
        {sales.changed && (
          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            You&apos;ve changed this pipeline&apos;s name or stages on Deals, so it keeps the stages you gave it whatever this switch says.
            Add or take off the won stage there, or put the pipeline back as it came.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href={PATHS.pipelines} className={clsx(ui.link, "text-[13px] font-medium")}>
            Open Deals
          </Link>
          {status && <p className={clsx("text-sm", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
        </div>
      </div>
    </div>
  );
}
