"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { BookMarked, Check, ExternalLink, Globe } from "lucide-react";
import { hostOf, type SolSource } from "@/lib/domain/design/sol-knowledge";

/** "/are/store/3268": the page within its site. */
const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + u.search) || "/";
  } catch {
    return url;
  }
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * The sources under one of Sol's answers (1 Nov 2026, Martin: "a little sources icon to validate where the information
 * was obtained"): a small round with the globe (from the web) or the bookmark (from his memory) and how many, which opens
 * the pages, each with its site, title and, from memory, when it was found. Beside it, what was kept in his memory, or
 * Remember this when the answer came from the web and isn't kept yet.
 */
export function SolSources(props: {
  sources: readonly SolSource[];
  remembered?: readonly { id: string; question: string }[];
  /** Keeps the answer in his memory; absent where keeping isn't offered (a past conversation). */
  onRemember?: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const { sources } = props;
  if (!sources.length) return null;
  const web = sources.filter((s) => s.from === "web").length;
  const memory = sources.length - web;
  const Icon = web ? Globe : BookMarked;
  const kept = props.remembered?.length ?? 0;
  return (
    <div ref={box} className="relative flex flex-wrap items-center gap-2 px-1 text-[11px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Where this came from"
        className={clsx(
          "inline-flex h-6 items-center gap-1.5 rounded-full pl-1 pr-2.5 ring-1 transition",
          open ? "bg-ink text-white ring-ink" : "bg-surface text-ink-2 ring-line hover:text-ink",
        )}
      >
        <span className={clsx("inline-flex size-4 items-center justify-center rounded-full", open ? "bg-white/15" : "bg-sun")}>
          <Icon className={clsx("size-2.5", open ? "text-white" : "text-sun-ink")} aria-hidden />
        </span>
        {sources.length} {sources.length === 1 ? "source" : "sources"}
        {memory > 0 && web > 0 && <span className="text-muted">· {memory} from memory</span>}
      </button>
      {kept > 0 ? (
        <span className="inline-flex items-center gap-1 text-positive">
          <Check className="size-3" aria-hidden /> Kept in Sol&apos;s memory
        </span>
      ) : (
        web > 0 &&
        props.onRemember && (
          <button
            type="button"
            disabled={keeping}
            onClick={async () => {
              setKeeping(true);
              await props.onRemember?.();
              setKeeping(false);
            }}
            title="Keep this answer, with its sources, for everyone in the business"
            className="inline-flex items-center gap-1 text-muted hover:text-ink disabled:text-muted"
          >
            <BookMarked className="size-3" aria-hidden /> {keeping ? "Keeping…" : "Remember this"}
          </button>
        )
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Sources"
          className="absolute left-0 top-full z-20 mt-1.5 w-[min(22rem,80vw)] rounded-2xl bg-surface p-2 text-[12px] shadow-[0_12px_32px_rgba(20,22,26,0.16)] ring-1 ring-line"
        >
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Sources</p>
          <ul>
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  referrerPolicy="no-referrer"
                  className="flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-canvas"
                >
                  {s.from === "memory" ? (
                    <BookMarked className="mt-0.5 size-3.5 shrink-0 text-sun-ink" aria-hidden />
                  ) : (
                    <Globe className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{s.title || hostOf(s.url)}</span>
                    <span className="block truncate text-muted">
                      {/* With no title of its own the site is the title: say which page of it instead. */}
                      {s.title && s.title !== hostOf(s.url) ? hostOf(s.url) : pathOf(s.url)}
                      {s.from === "memory" && s.at ? ` · from Sol's memory, found ${day(s.at)}` : ""}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-muted">
            Check figures, dates and contact details against the page before relying on them.
          </p>
        </div>
      )}
    </div>
  );
}
