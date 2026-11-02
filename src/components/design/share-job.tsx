"use client";

import clsx from "clsx";
import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { shareLive, statusWords, type ShareStatus } from "@/lib/domain/design/job-shares";
import { loadShare, sendToInstaller, takeJobBack } from "@/lib/services/job-shares";

const head = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";

/**
 * On the job card, for the retailer: send the job to an installer it is connected with on RENUABL (job-shares.ts),
 * where it waits in their Jobs until they accept; then where it stands, and Take it back.
 */
export function ShareJob({ jobId }: { jobId: string }) {
  const [data, setData] = useState<{ share: ShareStatus | null; installers: { key: string; name: string }[] } | null>(null);
  const [to, setTo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadShare(jobId).then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, [jobId]);
  if (!data) return problem ? <p className="text-xs text-warning">{problem}</p> : null;
  const live = data.share && shareLive(data.share.state) ? data.share : null;
  const run = async (work: () => ReturnType<typeof takeJobBack>) => {
    setBusy(true);
    const res = await work();
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setData({ ...data, share: res.share });
  };
  return (
    <div>
      <p className={head}>Send on RENUABL</p>
      {live ? (
        <div className="mt-1">
          <p className={clsx("text-sm", live.state === "accepted" ? "text-positive" : "text-ink")}>{statusWords(live)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm(`Take this job back from ${live.to}? Their job card closes.`) && void run(() => takeJobBack(jobId))
            }
            className="mt-1 text-xs text-muted underline underline-offset-4 hover:text-danger"
          >
            Take it back
          </button>
        </div>
      ) : data.installers.length ? (
        <>
          {data.share && <p className="mt-1 text-xs text-muted">{statusWords(data.share)}.</p>}
          <div className="mt-1 flex gap-2">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Connected installer"
              className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm"
            >
              <option value="">Choose a connected installer…</option>
              {data.installers.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!to || busy}
              onClick={() => void run(() => sendToInstaller(jobId, to))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
            >
              <Send className="size-3.5" aria-hidden /> Send
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">
            It waits in their Jobs. Once they accept, they see this card, without the customer&apos;s email.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          No installers connected yet.{" "}
          <Link href="/design/connections" className="font-medium text-ink underline underline-offset-4">
            Connect with the installers you use
          </Link>
          .
        </p>
      )}
      {problem && <p className="mt-1 text-xs text-warning">{problem}</p>}
    </div>
  );
}
