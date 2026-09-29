"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { formatAddress } from "@/lib/mock/addresses";
import { requestFollowUp } from "@/lib/services/consumer";
import { useFlow } from "./flow-state";

/**
 * "Don't have your bill handy?": the visitor leaves their email so we can
 * follow up, instead of leaving. They still need the bill to continue.
 */
export function BillLater() {
  const { state } = useFlow();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (state.bill) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const r = await requestFollowUp({
      email,
      home: state.address ? formatAddress(state.address) : undefined,
      source: [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setProblem(r.message ?? "That didn't send. Please try again.");
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-sage/50 px-5 py-4 text-forest" role="status">
        <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        <p className="text-[14px]">Thanks. We&apos;ll be in touch, and you can come back and add your bill any time.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-[var(--radius-card)] border border-line px-5 py-4">
      <p className="text-[15px] text-ink">Don&apos;t have your bill handy right now?</p>
      <p className="mt-0.5 text-[13px] text-muted">Enter your email and we&apos;ll get in touch.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-ink"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get in touch"}
        </Button>
      </div>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <p className="mt-2 text-[11.5px] leading-snug text-muted">
        We&apos;ll only email you about your RENUABL plan.{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-ink">
          Privacy
        </Link>
      </p>
    </form>
  );
}
