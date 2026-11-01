"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Phone, Search, SquareKanban, UserRound } from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { PHONE_FROM, digitsOf, looksLikePhone, looksLikeQuestion, matches } from "@/lib/domain/design/find";
import { listCustomers, listJobs, type CustomerLine, type JobLine } from "@/lib/services/crm";
import { SOL_ASK } from "@/lib/services/sol";
import { SolIcon } from "./sol-icon";

interface Hit {
  key: string;
  kind: "customer" | "deal" | "sol";
  title: string;
  line: string;
  href: string;
}

/**
 * Search, or ask Sol (31 Oct 2026, as Primero's; 1 Nov 2026, Martin: one box for both): Ctrl K or ⌘K anywhere, or the
 * round magnifier. Who's calling, matched as each digit of their number goes in (`matches` in find.ts), or by name,
 * email or address; then their deals. Anything typed that isn't a number can also be asked of Sol: "Ask Sol" comes
 * first when it reads as a question (`looksLikeQuestion`), else after what was found, and opens his panel with it
 * asked. Arrows and Enter choose. The business's customers and deals are read once when it opens.
 */
export function PageSearch(props: { open: boolean; onClose: () => void; customer: (id: string) => string; deal: (id: string) => string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [data, setData] = useState<{ customers: CustomerLine[]; jobs: JobLine[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const t = setTimeout(() => input.current?.focus(), 0);
    let gone = false;
    void Promise.all([listCustomers(), listJobs()]).then(([c, j]) => {
      if (gone) return;
      if (!c.ok || !j.ok) return setFailed(true);
      setData({ customers: c.customers, jobs: j.jobs });
    });
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [props.open]);

  if (!props.open) return null;
  const typed = q.trim();
  const phone = looksLikePhone(typed);
  const ready = phone ? digitsOf(typed).length >= PHONE_FROM : typed.length >= 2;
  const hits: Hit[] =
    !data || !ready
      ? []
      : [
          ...data.customers
            .filter((c) => matches({ words: [c.name, c.email, c.address], phone: c.phone }, typed))
            .slice(0, 6)
            .map((c) => ({
              key: `c:${c.id}`,
              kind: "customer" as const,
              title: c.name,
              line: [c.phone, c.address].filter(Boolean).join(" · "),
              href: props.customer(c.id),
            })),
          ...data.jobs
            .filter((j) => {
              const owner = data.customers.find((c) => c.id === j.customerId);
              return matches({ words: [j.customerName, j.title, j.address], phone: owner?.phone }, typed);
            })
            .slice(0, 6)
            .map((j) => ({
              key: `d:${j.id}`,
              kind: "deal" as const,
              title: `${j.customerName} · ${j.title}`,
              line: [STAGE_LABELS[j.stage], j.address].filter(Boolean).join(" · "),
              href: props.deal(j.id),
            })),
        ];
  // Sol is offered for anything that isn't a number: first when it reads as a question, else after what was found.
  if (typed.length >= 2 && !phone) {
    const sol: Hit = { key: "sol", kind: "sol", title: `Ask Sol: “${typed}”`, line: "Opens Sol beside this page", href: "" };
    if (looksLikeQuestion(typed) || hits.length === 0) hits.unshift(sol);
    else hits.push(sol);
  }
  const chosen = Math.min(at, Math.max(0, hits.length - 1));
  const close = () => {
    setQ("");
    setAt(0);
    props.onClose();
  };
  const go = (h: Hit) => {
    close();
    if (h.kind === "sol") window.dispatchEvent(new CustomEvent(SOL_ASK, { detail: typed }));
    else router.push(h.href);
  };

  return (
    <div className="fixed inset-0 z-[60] print:hidden" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={close} />
      <div className="absolute inset-x-3 top-[8dvh] mx-auto max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
        <label className="flex items-center gap-3 border-b border-line px-4">
          {phone ? (
            <Phone className="size-5 shrink-0 text-muted" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-muted" aria-hidden />
          )}
          <input
            ref={input}
            value={q}
            inputMode={phone ? "tel" : undefined}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt(Math.min(chosen + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt(Math.max(chosen - 1, 0));
              } else if (e.key === "Enter" && hits[chosen]) {
                e.preventDefault();
                go(hits[chosen]);
              }
            }}
            placeholder="Search a name or number, or ask Sol anything"
            aria-label="Find a customer or deal by phone number, name, email or address, or ask Sol"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-xs text-muted sm:inline">Esc</kbd>
        </label>
        <ul className="staff-scroll max-h-[60dvh] overflow-y-auto p-2" role="listbox" aria-label="Found">
          {hits.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              {failed ? (
                "The search couldn't be read just now. Close it and try again."
              ) : !ready ? (
                phone ? (
                  "Keep typing the number: it starts matching from the fourth digit."
                ) : (
                  "Type their number as it rings, their name, email or address, or a question for Sol."
                )
              ) : !data ? (
                <span className="animate-pulse">Searching…</span>
              ) : phone ? (
                "No customer has a number with those digits."
              ) : (
                "Nothing matches that."
              )}
            </li>
          )}
          {hits.map((h, n) => {
            const Icon = h.kind === "customer" ? UserRound : h.kind === "deal" ? SquareKanban : SolIcon;
            const on = n === chosen;
            return (
              <li key={h.key} role="option" aria-selected={on}>
                <button
                  type="button"
                  onMouseEnter={() => setAt(n)}
                  onClick={() => go(h)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                    on ? "bg-ink text-white" : "text-ink hover:bg-canvas",
                  )}
                >
                  <Icon className={clsx("size-4 shrink-0", h.kind === "sol" && !on && "text-sun-line")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.title}</span>
                    {h.line && <span className={clsx("block truncate text-xs", on ? "text-white/70" : "text-muted")}>{h.line}</span>}
                  </span>
                  {on && <CornerDownLeft className="size-4 shrink-0 opacity-70" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
