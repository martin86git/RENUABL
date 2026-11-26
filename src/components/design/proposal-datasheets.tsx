"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, FileText, Loader2, X } from "lucide-react";
import {
  DATASHEET_WORDS,
  DOC_KIND_WORDS,
  sheetsForChoice,
  type ProductSheetStanding,
  type ProposalDatasheet,
} from "@/lib/domain/design/proposal-datasheets";
import { findQuotedOnline } from "@/lib/services/datasheets";
import type { OptionKey } from "@/lib/domain/design/proposal";

/**
 * The maker's datasheet for each product in the proposal (26 Nov 2026, Martin): one row a product, its kind and name,
 * opening the sheet in a new tab. With a choice of systems, only the sheets for the system on show. Nothing when none
 * are on hand.
 */
export function ProposalDatasheets(props: {
  sheets: readonly ProposalDatasheet[];
  chosen: OptionKey | null;
  href: (id: string) => string;
}) {
  const sheets = sheetsForChoice(props.sheets, props.chosen);
  if (!sheets.length) return null;
  return (
    <section id="datasheets" aria-label={DATASHEET_WORDS.heading} className="border-t border-line pt-8">
      <h2 className="text-[20px] leading-tight tracking-tight text-ink [font-family:var(--proposal-heading)]">{DATASHEET_WORDS.heading}</h2>
      <p className="mt-1 text-[13.5px] text-muted">{DATASHEET_WORDS.intro}</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {sheets.map((s) => (
          <li key={s.id}>
            <a
              href={props.href(s.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition hover:border-ink/30"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink">
                <FileText className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{DOC_KIND_WORDS[s.kind]}</span>
                <span className="block truncate text-[14px] text-ink">{s.name}</span>
              </span>
              <span className="shrink-0 text-[13px] font-medium text-ink underline underline-offset-4">{DATASHEET_WORDS.open}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * On the business's proposal screen: each quoted product and whether its datasheet goes with the proposal, those
 * still to check marked, with Find the missing ones online and Settings to upload one (26 Nov 2026, Martin).
 */
export function DatasheetCheck(props: { products: readonly ProductSheetStanding[]; onFound: () => void }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  if (!props.products.length) return null;
  const missing = props.products.filter((p) => !p.hasFile);
  const find = async () => {
    setBusy(true);
    setSaid(null);
    const res = await findQuotedOnline(missing.map((p) => ({ kind: p.kind, sku: p.sku, name: p.name })));
    setBusy(false);
    if (!res.ok) return setSaid(res.message);
    setSaid(
      res.found
        ? `Found ${res.found} online. ${res.found < missing.length ? "Upload the rest in Settings." : ""}`.trim()
        : "Couldn't find them online. Upload each in Settings, Product datasheets.",
    );
    props.onFound();
  };
  return (
    <div className="rounded-md border border-line bg-surface p-3 text-xs text-ink-2">
      <p className="font-medium text-ink">{DATASHEET_WORDS.heading}</p>
      <p className="mt-0.5 text-muted">{missing.length ? DATASHEET_WORDS.missingSome : DATASHEET_WORDS.allThere}</p>
      <ul className="mt-2 space-y-1">
        {props.products.map((p) => (
          <li key={`${p.kind}:${p.sku}`} className="flex items-start gap-2">
            {p.hasFile ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-label="On file" />
            ) : busy ? (
              <Loader2
                className="mt-0.5 size-3.5 shrink-0 animate-spin text-sun-line motion-reduce:animate-none"
                aria-label="Looking online"
              />
            ) : (
              <X className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Missing" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-muted">{DOC_KIND_WORDS[p.kind]} · </span>
              {p.name}
              {p.hasFile && p.unchecked && <span className="text-muted"> · found online, to check</span>}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => void find()}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white disabled:cursor-progress"
          >
            {busy && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />}
            {busy ? "Looking online…" : DATASHEET_WORDS.find}
          </button>
          <Link href="/design/settings/datasheets" className="font-medium underline underline-offset-4">
            Upload in Settings
          </Link>
        </div>
      )}
      {busy && (
        <p role="status" className="mt-1.5 animate-pulse text-muted motion-reduce:animate-none">
          Searching the makers&apos; sites for {Math.min(6, missing.length)} datasheet{Math.min(6, missing.length) === 1 ? "" : "s"}. This
          can take a minute.
        </p>
      )}
      {said && !busy && (
        <p role="status" className="mt-1.5 text-muted">
          {said}
        </p>
      )}
    </div>
  );
}
