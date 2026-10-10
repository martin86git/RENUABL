"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Wordmark } from "@/components/ui/primitives";
import {
  COMPONENTS,
  DEFAULT_WORKSPACE,
  INSTALL_RATES,
  MAX_SUPPLIER_LISTS,
  SETTING_GROUPS,
  getSetting,
  listed,
  readSupplierList,
  withSetting,
  withSupplierList,
  type SettingField,
  type Workspace,
} from "@/lib/domain/design/pricing";
import { loadWorkspace, saveWorkspace, savedLabel } from "@/lib/services/design-store";
import { DesignAccountLink, DesignSettingsKeptNote } from "./design-account";

const input =
  "block min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm tabular-nums outline-none focus:border-forest disabled:bg-surface-2 disabled:text-muted";
const eyebrow = "text-[11px] font-medium uppercase tracking-[0.14em] text-forest";
const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A number box that keeps what is typed while it is typed (so "0." isn't thrown away) and hands on each figure
 * that reads as a number within its bounds. Empty hands on null where that is allowed.
 */
function NumberBox(props: {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  allowEmpty?: boolean;
  placeholder?: string;
  label: string;
}) {
  const [typed, setTyped] = useState(props.value === null ? "" : String(props.value));
  return (
    <input
      type="number"
      inputMode="decimal"
      min={props.min}
      max={props.max}
      step={props.step}
      value={typed}
      placeholder={props.placeholder}
      aria-label={props.label}
      onChange={(e) => {
        setTyped(e.target.value);
        if (e.target.value.trim() === "") return props.allowEmpty ? props.onChange(null) : undefined;
        const n = Number(e.target.value);
        if (Number.isFinite(n)) props.onChange(Math.min(props.max, Math.max(props.min, n)));
      }}
      onBlur={() => setTyped(props.value === null ? "" : String(props.value))}
      className={input}
    />
  );
}

/** A share (0 to 1) is typed as a percentage. */
const shown = (f: SettingField, value: number) => (f.unit === "%" ? Math.round(value * 10000) / 100 : value);
const stored = (f: SettingField, value: number) => (f.unit === "%" ? value / 100 : value);

/**
 * The business's settings for the roof designer's quote (/design/settings): supplier price lists, the parts every
 * job needs, installation rates, margin, fixed costs and the bill a new job starts with. Kept for the signed-in
 * business, or on this device when nobody is signed in (`design-store.ts`), saved as each thing is changed.
 */
export function DesignSettings() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<string>("");
  const [upload, setUpload] = useState<{ busy?: boolean; message?: string; error?: boolean }>({});
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // From the account, or this device's storage. If the account can't be reached, say so rather than show the starting figures.
    let gone = false;
    loadWorkspace().then(
      (loaded) => !gone && setWorkspace(loaded),
      (e: unknown) => !gone && setStatus(e instanceof Error ? e.message : "Your settings couldn't be loaded. Reload the page."),
    );
    return () => {
      gone = true;
    };
  }, []);

  const change = (next: Workspace) => {
    setWorkspace(next);
    return saveWorkspace(next).then(async (problem) => setStatus(problem ?? (await savedLabel())));
  };

  const send = async (chosen: File) => {
    if (!workspace) return;
    setUpload({ busy: true });
    try {
      const body = new FormData();
      body.set("file", chosen);
      const res = await fetch("/api/design/price-list", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; name?: string; rows?: string[][]; message?: string };
      if (!json.ok || !json.rows) return setUpload({ error: true, message: json.message ?? "That file couldn't be read." });
      const list = readSupplierList(json.name ?? chosen.name, json.rows, new Date().toISOString().slice(0, 10));
      if (!list.items.length)
        return setUpload({
          error: true,
          message: "We couldn't find priced rows in that file. It needs a product code, a description and a price in its first columns.",
        });
      void change({ ...workspace, lists: withSupplierList(workspace.lists, list) });
      setUpload({
        message: `Read ${list.items.length.toLocaleString("en-AU")} priced rows from ${list.name}: ${list.panels.length} panels, ${list.inverters.length} inverters, ${list.batteries.length} batteries.`,
      });
    } catch {
      setUpload({ error: true, message: "We couldn't reach the server. Try again in a moment." });
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-canvas/95 px-5 py-3 backdrop-blur lg:px-10">
        <Link href="/" aria-label="RENUABL home">
          <Wordmark className="text-[17px]" />
        </Link>
        <span className="text-sm text-ink-2">Prices and settings</span>
        <span className="ml-auto text-xs text-muted" role="status">
          {status}
        </span>
        <DesignAccountLink />
        <Link
          href="/design"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-ink hover:bg-forest"
        >
          Back to the designer
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-5 pt-8">
        <div>
          <p className={eyebrow}>Roof designer</p>
          <h1 className="mt-2 text-[30px] leading-tight tracking-tight text-ink sm:text-[36px]">Your prices and settings.</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            The quote beside a design is worked out from what you set here. Every figure is ex GST, and each change is saved as you make it.
            The figures you start with are placeholders: replace them with your own.
          </p>
        </div>

        {!workspace ? null : (
          <>
            <section
              className="rounded-[1.25rem] bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6"
              aria-labelledby="lists"
            >
              <h2 id="lists" className="text-[19px] tracking-tight text-ink">
                Supplier price lists
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                Upload your wholesaler&apos;s price list as Excel (.xlsx) or CSV, with the product code, description and price in the first
                columns. Its panels, inverters and batteries appear in the designer, and every priced row can be looked up by its code. Up
                to {MAX_SUPPLIER_LISTS} lists; where two price the same code, the newest wins. Uploading a file of the same name replaces
                it.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={file}
                  type="file"
                  accept=".xlsx,.csv"
                  className="sr-only"
                  id="price-list"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) void send(chosen);
                  }}
                />
                <label
                  htmlFor="price-list"
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-ink hover:bg-forest"
                >
                  <Upload className="size-4" aria-hidden /> {upload.busy ? "Reading…" : "Upload a price list"}
                </label>
                {upload.message && (
                  <p className={upload.error ? "text-sm text-danger" : "text-sm text-positive"} role="status">
                    {upload.message}
                  </p>
                )}
              </div>
              {workspace.lists.length === 0 ? (
                <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
                  No price list yet. Until there is one, the designer offers our own range and the quote shows each product as having no
                  cost on file.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {workspace.lists.map((list) => (
                    <li key={list.name} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{list.name}</p>
                        <p className="text-xs tabular-nums text-muted">
                          Uploaded {list.uploadedAt} · {list.items.length.toLocaleString("en-AU")} priced rows · {list.panels.length} panels
                          · {list.inverters.length} inverters · {list.batteries.length} batteries
                        </p>
                      </div>
                      <button
                        onClick={() => change({ ...workspace, lists: workspace.lists.filter((l) => l.name !== list.name) })}
                        className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-canvas hover:text-danger"
                        aria-label={`Remove ${list.name}`}
                        title="Remove this list"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="rounded-[1.25rem] bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6"
              aria-labelledby="parts"
            >
              <h2 id="parts" className="text-[19px] tracking-tight text-ink">
                Parts on every job
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                The quote adds these by rule: rails and roof kits for the panels drawn, a meter and an isolator for the phase. Give each
                your wholesaler&apos;s product code and its price comes from your lists; or type a cost, which is used instead.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-muted">
                      <th className="pb-2 pr-3 font-medium">Part</th>
                      <th className="w-44 pb-2 pr-3 font-medium">Product code</th>
                      <th className="pb-2 pr-3 font-medium">On your lists</th>
                      <th className="w-28 pb-2 font-medium">Your cost ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPONENTS.map((c) => {
                      const choice = workspace.components[c.key];
                      const hit = listed(workspace, choice.sku);
                      const set = (patch: Partial<typeof choice>) =>
                        change({ ...workspace, components: { ...workspace.components, [c.key]: { ...choice, ...patch } } });
                      return (
                        <tr key={c.key} className="border-b border-line align-middle last:border-0">
                          <td className="py-2 pr-3 text-ink">{c.label}</td>
                          <td className="py-2 pr-3">
                            <input
                              value={choice.sku}
                              onChange={(e) => set({ sku: e.target.value.trim().slice(0, 60) })}
                              aria-label={`Product code for ${c.label}`}
                              className={input}
                            />
                          </td>
                          <td className="py-2 pr-3 text-xs">
                            {hit ? (
                              <span className="text-ink-2">
                                {hit.name} · <span className="tabular-nums text-ink">{money(hit.cost)}</span>
                              </span>
                            ) : choice.cost !== null ? (
                              <span className="text-muted">Using the cost typed in</span>
                            ) : (
                              <span className="text-warning">Not found: no cost on file</span>
                            )}
                          </td>
                          <td className="py-2">
                            <NumberBox
                              value={choice.cost}
                              onChange={(cost) => set({ cost })}
                              min={0}
                              max={100000}
                              step={0.01}
                              allowEmpty
                              placeholder={hit ? "From list" : "Set a cost"}
                              label={`Your cost for ${c.label}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="rounded-[1.25rem] bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6"
              aria-labelledby="install"
            >
              <h2 id="install" className="text-[19px] tracking-tight text-ink">
                Installation rates
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                What installing costs you, ex GST. The quote applies them from the drawing: watts of panels, arrays counted on the roof,
                tilted panels on a flat roof, and the storeys and phase you pick. A rate left at 0 adds no line.
              </p>
              <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                {INSTALL_RATES.map((r) => (
                  <label key={r.key} className="block text-sm text-ink">
                    <span className="flex justify-between gap-2">
                      {r.label} <span className="text-xs text-muted">{r.unit}</span>
                    </span>
                    <span className="mt-1 block">
                      <NumberBox
                        value={workspace.install[r.key]}
                        onChange={(v) => v !== null && change({ ...workspace, install: { ...workspace.install, [r.key]: v } })}
                        min={0}
                        max={r.max}
                        step={r.step}
                        label={r.label}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {SETTING_GROUPS.map((group) => (
              <section
                key={group.title}
                className="rounded-[1.25rem] bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6"
                aria-label={group.title}
              >
                <h2 className="text-[19px] tracking-tight text-ink">{group.title}</h2>
                <p className="mt-1 text-sm text-ink-2">{group.intro}</p>
                <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {group.fields.map((f) => (
                    <label key={f.path} className="block text-sm text-ink">
                      <span className="flex justify-between gap-2">
                        {f.label} <span className="text-xs text-muted">{f.unit}</span>
                      </span>
                      <span className="mt-1 block">
                        <NumberBox
                          value={shown(f, getSetting(workspace.settings, f.path))}
                          onChange={(v) =>
                            v !== null && change({ ...workspace, settings: withSetting(workspace.settings, f.path, stored(f, v)) })
                          }
                          min={shown(f, f.min)}
                          max={shown(f, f.max)}
                          step={f.unit === "%" ? 1 : f.step}
                          label={f.label}
                        />
                      </span>
                      {f.help && <span className="mt-1 block text-xs text-muted">{f.help}</span>}
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-surface-2 p-5">
              <p className="max-w-xl text-sm text-ink-2">
                <DesignSettingsKeptNote />
              </p>
              <button
                onClick={() => {
                  if (window.confirm("Put every setting back to the starting figures and remove your price lists?")) {
                    setUpload({});
                    // The boxes keep what was typed: opening the page again, once it's saved, shows the starting figures.
                    void change(DEFAULT_WORKSPACE).then(() => window.location.reload());
                  }
                }}
                className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-danger hover:border-danger"
              >
                Start again
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
