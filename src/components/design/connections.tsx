"use client";

import clsx from "clsx";
import { Check, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  KIND_FILTERS,
  MIN_QUERY,
  STATES,
  entryLine,
  type DirectoryEntry,
  type KindFilter,
  type Listing,
  type Standing,
} from "@/lib/domain/design/connections";
import { connectionAction, loadConnections, searchDirectory, type ConnectionLine, type Connections } from "@/lib/services/connections";
import { PageHead, ui } from "./design-shell";

const FILTER_WORDS: Record<KindFilter, string> = {
  all: "Everyone",
  retailer: "Retailers",
  installer: "Installers",
  inspector: "Inspectors",
};

/**
 * Connections (1 Nov 2026, Martin: find the businesses you already work with and connect, like a friend request; the
 * directory is opt-in). Requests waiting for an answer first, then the businesses connected, those asked, a search of
 * the directory, and this business's own listing beside it. Rules in domain/design/connections.ts.
 */
export function ConnectionsPage() {
  const [data, setData] = useState<Connections | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadConnections().then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, []);
  const act = async (body: Record<string, unknown>) => {
    const res = await connectionAction(body);
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setData(res);
    window.dispatchEvent(new Event("renuabl:connections"));
    return true;
  };
  const by = (s: ConnectionLine["standing"]) => data?.connections.filter((c) => c.standing === s) ?? [];
  const incoming = by("incoming");
  const connected = by("connected");
  const asked = by("requested");
  return (
    <div className={clsx(ui.page, "space-y-6")}>
      <PageHead title="Connections" />
      <p className="-mt-3 max-w-2xl text-sm text-ink-2">
        The businesses you work with. A connection shares nothing by itself: once connected, jobs pass between you one at a time.
      </p>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            {incoming.length > 0 && (
              <section className={clsx(ui.card, "p-5")}>
                <p className={ui.eyebrow}>Asked to connect with you</p>
                <ul className="mt-3 divide-y divide-line">
                  {incoming.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Who entry={c.business} />
                      <div className="ml-auto flex gap-2">
                        <button type="button" onClick={() => void act({ do: "accept", id: c.id })} className={clsx(ui.primary, "h-9")}>
                          <Check className="size-4" aria-hidden /> Accept
                        </button>
                        <button type="button" onClick={() => void act({ do: "decline", id: c.id })} className={clsx(ui.quiet, "h-9")}>
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>Connected</p>
              {!connected.length ? (
                <p className="mt-2 text-sm text-ink-2">No connections yet. Find the businesses you work with below.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {connected.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Who entry={c.business} />
                      <span className="ml-auto text-xs text-muted">Since {day(c.since)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm(`Disconnect from ${c.business.name}? Jobs can no longer pass between you.`) &&
                          void act({ do: "disconnect", id: c.id })
                        }
                        className="text-xs text-muted underline underline-offset-4 hover:text-danger"
                      >
                        Disconnect
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {asked.length > 0 && (
                <>
                  <p className={clsx(ui.eyebrow, "mt-5")}>Waiting for them</p>
                  <ul className="mt-2 divide-y divide-line">
                    {asked.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                        <Who entry={c.business} />
                        <button
                          type="button"
                          onClick={() => void act({ do: "cancel", id: c.id })}
                          className="ml-auto text-xs text-muted underline underline-offset-4 hover:text-ink"
                        >
                          Cancel request
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <Find act={act} />
          </div>
          <ListingCard listing={data.listing} act={act} />
        </div>
      )}
    </div>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

function Who({ entry }: { entry: DirectoryEntry }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink">
        {entry.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-ink">{entry.name}</span>
        <span className="block truncate text-xs text-muted">{entryLine(entry)}</span>
      </span>
    </span>
  );
}

/** A search of the directory: every word must match a listed business's name, suburb or state, or its whole ABN. */
function Find({ act }: { act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [results, setResults] = useState<(DirectoryEntry & { standing: Standing })[] | null>(null);
  const [asks, setAsks] = useState(0);
  useEffect(() => {
    if (q.trim().length < MIN_QUERY) return;
    const t = setTimeout(() => void searchDirectory(q, kind).then((res) => setResults(res.ok ? res.results : [])), 250);
    return () => clearTimeout(t);
  }, [q, kind, asks]);
  const searching = q.trim().length >= MIN_QUERY;
  return (
    <section className={clsx(ui.card, "p-5")}>
      <p className={ui.eyebrow}>Find a business</p>
      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Business name, suburb or ABN"
          aria-label="Search the directory"
          className={clsx(ui.input, "h-11 pl-9")}
        />
      </label>
      <div role="radiogroup" aria-label="Kind of business" className="mt-3 flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={clsx(
              "h-8 rounded-full px-3 text-[13px]",
              kind === k ? "bg-ink text-canvas" : "bg-surface-2 text-ink-2 hover:text-ink",
            )}
          >
            {FILTER_WORDS[k]}
          </button>
        ))}
      </div>
      {!searching ? (
        <p className="mt-4 text-sm text-muted">Only businesses that have chosen to be listed appear.</p>
      ) : !results ? (
        <p className="mt-4 text-sm text-muted">Looking…</p>
      ) : !results.length ? (
        <p className="mt-4 text-sm text-ink-2">
          No listed business matches. They may not have listed themselves yet: ask them to, from their Connections page.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {results.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 py-3">
              <Who entry={r} />
              <span className="ml-auto">
                {r.standing === "none" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await act({ do: "ask", key: r.key })) setAsks((n) => n + 1);
                    }}
                    className={clsx(ui.quiet, "h-9")}
                  >
                    <UserPlus className="size-4" aria-hidden /> Connect
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                    {r.standing === "connected" ? (
                      <>
                        <Users className="size-4" aria-hidden /> Connected
                      </>
                    ) : r.standing === "requested" ? (
                      "Requested"
                    ) : (
                      "Asked you: see above"
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** This business in the directory: off until it chooses, with what others then see. */
function ListingCard({ listing, act }: { listing: Listing; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [listed, setListed] = useState(listing.listed);
  const [suburb, setSuburb] = useState(listing.suburb);
  const [state, setState] = useState<string>(listing.state);
  const [abn, setAbn] = useState(listing.abn);
  const [saved, setSaved] = useState(false);
  const changed = listed !== listing.listed || suburb !== listing.suburb || state !== listing.state || abn !== listing.abn;
  return (
    <section className={clsx(ui.card, "p-5")}>
      <p className={ui.eyebrow}>Your listing</p>
      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={listed}
          onChange={(e) => {
            setListed(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-sm text-ink">
          List my business in the directory
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            Others on RENUABL can find your name, kind of business, suburb and state, and ask to connect. Off, only businesses you ask can
            see you.
          </span>
        </span>
      </label>
      <div className="mt-4 space-y-3">
        <label className={ui.label}>
          Suburb
          <input
            value={suburb}
            onChange={(e) => (setSuburb(e.target.value), setSaved(false))}
            maxLength={60}
            className={clsx(ui.input, "mt-1")}
          />
        </label>
        <label className={ui.label}>
          State
          <select value={state} onChange={(e) => (setState(e.target.value), setSaved(false))} className={clsx(ui.input, "mt-1")}>
            <option value="">Choose</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.label}>
          ABN (optional)
          <input
            value={abn}
            onChange={(e) => (setAbn(e.target.value), setSaved(false))}
            inputMode="numeric"
            placeholder="So others can tell you apart"
            className={clsx(ui.input, "mt-1 tabular-nums")}
          />
        </label>
        <button
          type="button"
          disabled={!changed}
          onClick={async () => setSaved(await act({ do: "list", listed, suburb, state, abn }))}
          className={clsx(ui.primary, "w-full")}
        >
          Save
        </button>
        {saved && (
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <Check className="size-3.5 text-sun-line" aria-hidden /> {listing.listed ? "Listed." : "Saved. You're not listed."}
          </p>
        )}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        Never shown: the people in your business, their emails, your customers or your jobs.
      </p>
    </section>
  );
}
