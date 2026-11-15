"use client";

import { Check, Loader2, Search, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import {
  CONSENT_KINDS,
  CONSENT_WORDS,
  CONTACT_FIELDS,
  FIELD_LABELS,
  contactName,
  notEmailedBecause,
  type ColumnMap,
  type ConsentKind,
} from "@/lib/domain/marketing/contacts";
import { changeContacts, checkSheet, importSheet, loadContacts, type CheckedSheet, type ContactsView } from "@/lib/services/marketing";
import { CrmImport } from "./crm-import";

const box = "rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)]";
const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink/40";
const n = (v: number) => v.toLocaleString("en-AU");

/** The business's marketing contacts: bring in its customers or a sheet, sort into lists, record consent. */
export function MarketingContactsPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<ContactsView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const r = await loadContacts({ q, list, offset });
    if (!r.ok) return setProblem(r.message);
    setProblem(null);
    setView(r);
  }, [q, list, offset]);

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [refresh]);

  const c = view?.counts;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Go to market</p>
          <h1 className="text-[22px] font-semibold tracking-tight">Marketing contacts</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            The people your business emails. Only contacts with express or inferred consent who haven&apos;t unsubscribed or bounced can
            ever be emailed. Nothing is sent from this page.
          </p>
        </div>
      </div>

      {c && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["Contacts", c.total],
              ["Can be emailed", c.emailable],
              ["Consent not checked", c.unknown],
              ["Unsubscribed", c.unsubscribed],
              ["Bounced", c.bounced],
            ] as const
          ).map(([label, v], i) => (
            <div key={label} className={box}>
              <p className="text-[12px] text-muted">{label}</p>
              <p className={cn("mt-1 font-mono text-[22px] tabular-nums", i === 1 && "text-sun-line-ink")}>{n(v)}</p>
            </div>
          ))}
        </div>
      )}

      <CrmImport onDone={refresh} />

      <ImportCard onDone={refresh} />

      <ListsBar view={view} list={list} onPick={(id) => (setList(id), setOffset(0), setPicked(new Set()))} onChange={refresh} />

      <div className={cn(box, "mt-4 p-0")}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => (setQ(e.target.value), setOffset(0))}
              placeholder="Search email, name, company, state or source"
              className={cn(field, "pl-9")}
            />
          </label>
          <span className="text-[13px] text-muted">{view ? `${n(view.total)} shown` : ""}</span>
        </div>
        {picked.size > 0 && view && <BulkBar ids={[...picked]} view={view} list={list} onDone={() => (setPicked(new Set()), refresh())} />}
        {problem && <p className="px-5 py-3 text-[13px] text-danger">{problem}</p>}
        {!view ? (
          <p className="flex items-center gap-2 px-5 py-6 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading
          </p>
        ) : view.contacts.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">No contacts{q || list ? " match" : " yet. Import a sheet above"}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="w-10 px-5 py-2">
                    <input
                      type="checkbox"
                      aria-label="Pick every contact shown"
                      checked={view.contacts.every((x) => picked.has(x.id))}
                      onChange={(e) => setPicked(e.target.checked ? new Set([...picked, ...view.contacts.map((x) => x.id)]) : new Set())}
                    />
                  </th>
                  <th className="py-2 pr-4 font-normal">Contact</th>
                  <th className="py-2 pr-4 font-normal">Company</th>
                  <th className="py-2 pr-4 font-normal">State</th>
                  <th className="py-2 pr-4 font-normal">Consent</th>
                  <th className="py-2 pr-4 font-normal">Source</th>
                  <th className="py-2 pr-5 font-normal">Lists</th>
                </tr>
              </thead>
              <tbody>
                {view.contacts.map((x) => {
                  const why = notEmailedBecause(x);
                  return (
                    <tr key={x.id} className="border-b border-line last:border-0 hover:bg-canvas/60">
                      <td className="px-5 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Pick ${x.email}`}
                          checked={picked.has(x.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(x.id);
                            else next.delete(x.id);
                            setPicked(next);
                          }}
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{contactName(x)}</p>
                        <p className="text-muted">{x.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">{x.company ?? "--"}</td>
                      <td className="py-2.5 pr-4">{x.state ?? "--"}</td>
                      <td className="py-2.5 pr-4">
                        <span className={cn(why ? "text-muted" : "text-positive")} title={x.consentNote ?? undefined}>
                          {why ?? CONSENT_WORDS[x.consent].label}
                        </span>
                      </td>
                      <td className="max-w-[14rem] truncate py-2.5 pr-4 text-muted">{x.source}</td>
                      <td className="py-2.5 pr-5 text-muted">
                        {x.lists
                          .map((id) => view.lists.find((l) => l.id === id)?.name)
                          .filter(Boolean)
                          .join(", ") || "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {view && view.total > 50 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 text-[13px]">
            <span className="text-muted">
              {n(offset + 1)}–{n(Math.min(offset + 50, view.total))} of {n(view.total)}
            </span>
            <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
              Back
            </Button>
            <Button size="sm" variant="secondary" disabled={offset + 50 >= view.total} onClick={() => setOffset(offset + 50)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ListsBar({
  view,
  list,
  onPick,
  onChange,
}: {
  view: ContactsView | null;
  list: string | null;
  onPick: (id: string | null) => void;
  onChange: () => void;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  const chip = (on: boolean) =>
    cn("h-9 rounded-full border px-4 text-[13px]", on ? "border-ink bg-ink text-canvas" : "border-line bg-surface hover:border-ink/40");
  const current = view?.lists.find((l) => l.id === list);
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <button className={chip(!list)} onClick={() => onPick(null)}>
          Everyone
        </button>
        {view?.lists.map((l) => (
          <button key={l.id} className={chip(list === l.id)} onClick={() => onPick(l.id)}>
            {l.name} <span className="ml-1 font-mono text-[12px] opacity-70">{n(l.members)}</span>
          </button>
        ))}
        {naming === null ? (
          <button
            className="h-9 rounded-full border border-dashed border-line-strong px-4 text-[13px] text-muted hover:text-ink"
            onClick={() => setNaming("")}
          >
            New list
          </button>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await changeContacts({ do: "new-list", name: naming });
              if (r.ok) {
                setNaming(null);
                onChange();
              }
            }}
          >
            <input
              autoFocus
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              placeholder="List name"
              className={cn(field, "h-9 w-48")}
            />
            <Button size="sm" type="submit" disabled={!naming.trim()}>
              Add
            </Button>
            <button type="button" aria-label="Cancel" onClick={() => setNaming(null)} className="text-muted hover:text-ink">
              <X className="size-4" />
            </button>
          </form>
        )}
      </div>
      {current && (
        <p className="mt-2 text-[13px] text-muted">
          {n(current.members)} in {current.name}, {n(current.emailable)} of them can be emailed.{" "}
          <button
            className="underline underline-offset-4 hover:text-ink"
            onClick={async () => {
              if (!confirm(`Remove the list "${current.name}"? Its contacts stay.`)) return;
              await changeContacts({ do: "delete-list", list: current.id });
              onPick(null);
              onChange();
            }}
          >
            Remove list
          </button>
        </p>
      )}
    </div>
  );
}

function BulkBar({ ids, view, list, onDone }: { ids: string[]; view: ContactsView; list: string | null; onDone: () => void }) {
  const [target, setTarget] = useState("");
  const [consent, setConsent] = useState<ConsentKind | "">("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function run(body: Record<string, unknown>) {
    const r = await changeContacts(body);
    if (!r.ok) return setMsg(r.message);
    setMsg(null);
    onDone();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sun/40 px-5 py-3 text-[13px]">
      <span className="font-medium">{ids.length} picked</span>
      <select value={target} onChange={(e) => setTarget(e.target.value)} className={cn(field, "h-9 w-auto")}>
        <option value="">Add to a list…</option>
        {view.lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <Button size="sm" variant="secondary" disabled={!target} onClick={() => run({ do: "add", list: target, ids })}>
        Add
      </Button>
      {list && (
        <Button size="sm" variant="secondary" onClick={() => run({ do: "remove", list, ids })}>
          Take off this list
        </Button>
      )}
      <span className="mx-1 h-5 w-px bg-line" />
      <select value={consent} onChange={(e) => setConsent(e.target.value as ConsentKind)} className={cn(field, "h-9 w-auto")}>
        <option value="">Set consent…</option>
        {CONSENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {CONSENT_WORDS[k].label}
          </option>
        ))}
      </select>
      {consent && (consent === "express" || consent === "inferred") && (
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="How they consented" className={cn(field, "h-9 w-64")} />
      )}
      <Button size="sm" variant="secondary" disabled={!consent} onClick={() => run({ do: "consent", ids, consent, note })}>
        Set
      </Button>
      {msg && <span className="text-danger">{msg}</span>}
    </div>
  );
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<CheckedSheet | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [source, setSource] = useState("");
  const [consent, setConsent] = useState<ConsentKind>("unknown");
  const [note, setNote] = useState("");
  const [list, setList] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(f: File | null) {
    setFile(f);
    setSheet(null);
    setMsg(null);
    if (!f) return;
    setBusy(true);
    const r = await checkSheet(f);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setSheet(r);
    setMap(r.map);
    setSource((s) => s || f.name.replace(/\.(xlsx|csv|txt)$/i, ""));
  }

  async function run() {
    if (!file || !map) return;
    setBusy(true);
    const r = await importSheet(file, { map, source, consent, consentNote: note, list });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({
      ok: true,
      text: `Imported: ${n(r.added)} new, ${n(r.updated)} already held, ${n(r.skipped)} rows skipped. Nobody was emailed.`,
    });
    setFile(null);
    setSheet(null);
    if (input.current) input.current.value = "";
    onDone();
  }

  return (
    <div className={cn(box, "mt-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Import contacts</h2>
          <p className="text-[13px] text-muted">
            An Excel (.xlsx) or CSV sheet with a header row. One contact per email; contacts already held only gain blanks.
          </p>
        </div>
        <label
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-medium hover:border-ink/40",
          )}
        >
          {busy && !sheet ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {file ? file.name : "Choose a file"}
          <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {sheet && map && (
        <div className="mt-5 space-y-5">
          <p className="text-[13px] text-muted">{n(sheet.rows)} rows. Check which column holds each field.</p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CONTACT_FIELDS.map((f) => (
              <label key={f} className="text-[12px] text-muted">
                {FIELD_LABELS[f]}
                {f === "email" && " *"}
                <select
                  value={map[f]}
                  onChange={(e) => setMap({ ...map, [f]: Number(e.target.value) })}
                  className={cn(field, "mt-1 h-9 text-ink")}
                >
                  <option value={-1}>Not in the sheet</option>
                  {sheet.header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-[12px]">
              <thead className="bg-canvas text-muted">
                <tr>
                  {sheet.header.map((h, i) => (
                    <th key={i} className="px-3 py-1.5 text-left font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.sample.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((cell, j) => (
                      <td key={j} className="max-w-[12rem] truncate px-3 py-1.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[12px] text-muted">
              Where they came from *
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Solar installers list, bought Nov 2026"
                className={cn(field, "mt-1 text-ink")}
              />
            </label>
            <label className="text-[12px] text-muted">
              Add them to a list (optional)
              <input
                value={list}
                onChange={(e) => setList(e.target.value)}
                placeholder="A list's name; made if new"
                className={cn(field, "mt-1 text-ink")}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-[12px] text-muted">What consent do they give to be emailed? *</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CONSENT_KINDS.map((k) => (
                <label
                  key={k}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3",
                    consent === k ? "border-ink" : "border-line hover:border-ink/40",
                  )}
                >
                  <input type="radio" name="consent" checked={consent === k} onChange={() => setConsent(k)} className="mt-1" />
                  <span>
                    <span className="text-[13px] font-medium">{CONSENT_WORDS[k].label}</span>
                    <span className="block text-[12px] text-muted">{CONSENT_WORDS[k].help}</span>
                  </span>
                </label>
              ))}
            </div>
            {(consent === "express" || consent === "inferred") && (
              <label className="mt-3 block text-[12px] text-muted">
                How they consented * (kept with each contact, to show if asked)
                <input value={note} onChange={(e) => setNote(e.target.value)} className={cn(field, "mt-1 text-ink")} />
              </label>
            )}
            <p className="mt-2 text-[12px] text-muted">
              A bought list rarely carries consent to be emailed. If unsure, import as Not checked: they are kept, never emailed, and can be
              set later.
            </p>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={busy || map.email < 0 || !source.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Import {n(sheet.contacts)} contact{sheet.contacts === 1 ? "" : "s"}
            </Button>
            {sheet.skipped > 0 && (
              <span className="text-[13px] text-muted">{n(sheet.skipped)} rows will be skipped (no email, a bad one, or a repeat).</span>
            )}
            {map.email < 0 && <span className="text-[13px] text-danger">Choose the email column.</span>}
          </div>
        </div>
      )}
      {msg && <p className={cn("mt-4 text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}
