"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import type { InverterForm, PanelForm, SavedSheet, SheetKind } from "@/lib/domain/design/datasheets";
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL, type InverterElectrical, type PanelElectrical } from "@/lib/domain/design/electrical";
import { workspaceCatalogue } from "@/lib/domain/design/pricing";
import { shortDate } from "@/lib/services/crm";
import { deleteDatasheet, loadDatasheets, readDatasheet, saveDatasheet, type SheetForm } from "@/lib/services/datasheets";
import { loadWorkspace } from "@/lib/services/design-store";
import { ui } from "./design-shell";

const EMPTY_PANEL: PanelForm = { voc: "", vmp: "", isc: "", imp: "", vocPercent: "", iscPercent: "", pmaxPercent: "" };
const EMPTY_INVERTER: InverterForm = {
  maxVoltage: "",
  mppMin: "",
  mppMax: "",
  startVoltage: "",
  mppts: [{ maxCurrent: "", maxShortCircuit: "", strings: "1" }],
};
const PANEL_FIELDS: { key: keyof PanelForm; label: string; unit: string }[] = [
  { key: "voc", label: "Voc", unit: "V" },
  { key: "vmp", label: "Vmp", unit: "V" },
  { key: "isc", label: "Isc", unit: "A" },
  { key: "imp", label: "Imp", unit: "A" },
  { key: "vocPercent", label: "Voc temp. coefficient", unit: "%/°C" },
  { key: "iscPercent", label: "Isc temp. coefficient", unit: "%/°C" },
  { key: "pmaxPercent", label: "Pmax temp. coefficient", unit: "%/°C" },
];
const INVERTER_FIELDS: { key: Exclude<keyof InverterForm, "mppts">; label: string }[] = [
  { key: "maxVoltage", label: "Max input voltage" },
  { key: "mppMin", label: "MPPT range, from" },
  { key: "mppMax", label: "MPPT range, to" },
  { key: "startVoltage", label: "Start voltage" },
];

/**
 * Settings → Product datasheets (as Primero's): upload a panel's or inverter's datasheet, Claude reads its electrical
 * figures, a person checks them against the sheet, and once saved the string check, auto-stringing and Design it for me
 * use them for that product code. Without one, a product RENUABL has no figures for can't be strung by the designer.
 */
export function DatasheetSettings() {
  const [sheets, setSheets] = useState<SavedSheet[] | null>(null);
  const [products, setProducts] = useState<{ panels: { sku: string; name: string }[]; inverters: { sku: string; name: string }[] }>({
    panels: [],
    inverters: [],
  });
  const [form, setForm] = useState<(SheetForm & { sku: string; fileName: string }) | null>(null);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadDatasheets().then((res) => (res.ok ? setSheets(res.sheets) : setStatus({ ok: false, text: res.message })));
    void loadWorkspace()
      .then((w) => {
        const c = workspaceCatalogue(w);
        setProducts({ panels: c.panels ?? [], inverters: c.inverters ?? [] });
      })
      .catch(() => undefined);
  }, []);

  // Which products on the price lists still have no figures, from the business or RENUABL: the designer can't string them.
  const missing = useMemo(() => {
    const have = new Set((sheets ?? []).map((s) => `${s.kind}:${s.sku}`));
    return [
      ...products.panels
        .filter((p) => !have.has(`panel:${p.sku}`) && !PANEL_ELECTRICAL[p.sku])
        .map((p) => ({ ...p, kind: "panel" as const })),
      ...products.inverters
        .filter((i) => !have.has(`inverter:${i.sku}`) && !INVERTER_ELECTRICAL[i.sku])
        .map((i) => ({ ...i, kind: "inverter" as const })),
    ];
  }, [sheets, products]);

  const read = async (file: File) => {
    setReading(true);
    setStatus(null);
    const res = await readDatasheet(file);
    setReading(false);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    // A product code on the price list whose name the model reads like, if any.
    const list = res.form.kind === "panel" ? products.panels : products.inverters;
    const model = res.form.model.toLowerCase();
    const guess = list.find((p) => model.includes(p.sku.toLowerCase()) || model.includes(p.name.toLowerCase()));
    setForm({ ...res.form, sku: guess?.sku ?? "", fileName: res.fileName });
    setStatus({ ok: true, text: "Read. Check each figure against the datasheet before saving: blanks couldn't be read." });
  };
  const save = async () => {
    if (!form) return;
    const res = await saveDatasheet({
      kind: form.kind,
      sku: form.sku,
      model: form.model,
      fileName: form.fileName,
      ...(form.kind === "panel" ? { panel: form.panel } : { inverter: form.inverter }),
    });
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setSheets(res.sheets);
    setForm(null);
    setStatus({ ok: true, text: `Saved. The designer now checks strings for ${form.sku} with these figures.` });
  };

  return (
    <div className={clsx(ui.page, "max-w-4xl")}>
      <p className={ui.eyebrow}>Settings · Pricing</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Product datasheets</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Upload a panel&apos;s or inverter&apos;s datasheet and its electrical figures are read for you. Check them against the sheet, then
        save: the designer&apos;s string check, String automatically and Design it for me use them for that product code. The file itself
        isn&apos;t kept.
      </p>

      {missing.length > 0 && (
        <div className="mt-5 rounded-md bg-sun px-4 py-3 text-sm text-sun-ink">
          <p className="font-medium">
            {missing.length} product{missing.length === 1 ? "" : "s"} on your price lists can&apos;t be strung yet
          </p>
          <p className="mt-1 text-[13px]">
            {missing
              .slice(0, 8)
              .map((m) => m.sku)
              .join(", ")}
            {missing.length > 8 ? ` and ${missing.length - 8} more` : ""}. Upload their datasheets.
          </p>
        </div>
      )}

      <section className={clsx(ui.card, "mt-5 p-5")}>
        <div className="flex flex-wrap items-center gap-3">
          <label className={clsx(ui.primary, "cursor-pointer")}>
            <Upload className="size-4" aria-hidden /> {reading ? "Reading…" : "Upload a datasheet"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void read(f);
              }}
            />
          </label>
          {!form && (
            <button
              className={ui.quiet}
              onClick={() =>
                setForm({
                  kind: "panel",
                  model: "",
                  sku: "",
                  fileName: "",
                  panel: { ...EMPTY_PANEL },
                  inverter: structuredClone(EMPTY_INVERTER),
                })
              }
            >
              <Plus className="size-4" aria-hidden /> Type the figures in
            </button>
          )}
          <span className="text-xs text-muted">PDF or a photo, up to 10 MB.</span>
        </div>
        {status && <p className={clsx("mt-3 text-sm", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}

        {form && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
              <label className={ui.label}>
                It is a
                <select
                  className={clsx(ui.input, "mt-1.5 appearance-auto")}
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as SheetKind })}
                >
                  <option value="panel">Panel</option>
                  <option value="inverter">Inverter</option>
                </select>
              </label>
              <label className={ui.label}>
                Product code (as on your price list)
                <input
                  className={clsx(ui.input, "mt-1.5")}
                  list="datasheet-skus"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. JKM475N-48QL6-DV"
                />
                <datalist id="datasheet-skus">
                  {(form.kind === "panel" ? products.panels : products.inverters).map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className={ui.label}>
                Model, as on the sheet
                <input
                  className={clsx(ui.input, "mt-1.5")}
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </label>
            </div>

            {form.kind === "panel" ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PANEL_FIELDS.map((f) => (
                  <label key={f.key} className="block text-xs text-muted">
                    {f.label} ({f.unit})
                    <input
                      className={clsx(ui.input, "mt-1 tabular-nums", !form.panel[f.key] && "border-sun-line")}
                      inputMode="decimal"
                      value={form.panel[f.key]}
                      onChange={(e) => setForm({ ...form, panel: { ...form.panel, [f.key]: e.target.value } })}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {INVERTER_FIELDS.map((f) => (
                    <label key={f.key} className="block text-xs text-muted">
                      {f.label} (V)
                      <input
                        className={clsx(ui.input, "mt-1 tabular-nums", !form.inverter[f.key] && "border-sun-line")}
                        inputMode="decimal"
                        value={form.inverter[f.key]}
                        onChange={(e) => setForm({ ...form, inverter: { ...form.inverter, [f.key]: e.target.value } })}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-4 text-xs font-medium text-ink-2">MPPT inputs</p>
                <div className="mt-1.5 space-y-2">
                  {form.inverter.mppts.map((m, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <span className="w-14 pb-2.5 text-xs text-muted">MPPT {i + 1}</span>
                      {(
                        [
                          ["maxCurrent", "Max current (A)"],
                          ["maxShortCircuit", "Max short-circuit (A)"],
                          ["strings", "Strings"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block w-36 text-xs text-muted">
                          {label}
                          <input
                            className={clsx(ui.input, "mt-1 tabular-nums", !m[key] && "border-sun-line")}
                            inputMode="decimal"
                            value={m[key]}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                inverter: {
                                  ...form.inverter,
                                  mppts: form.inverter.mppts.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)),
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                      {form.inverter.mppts.length > 1 && (
                        <button
                          className="mb-1 inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                          aria-label={`Remove MPPT ${i + 1}`}
                          onClick={() =>
                            setForm({ ...form, inverter: { ...form.inverter, mppts: form.inverter.mppts.filter((_, j) => j !== i) } })
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.inverter.mppts.length < 12 && (
                    <button
                      className={clsx(ui.quiet, "h-8 px-3 text-xs")}
                      onClick={() =>
                        setForm({
                          ...form,
                          inverter: {
                            ...form.inverter,
                            mppts: [...form.inverter.mppts, { ...form.inverter.mppts[form.inverter.mppts.length - 1] }],
                          },
                        })
                      }
                    >
                      <Plus className="size-3.5" aria-hidden /> Add an MPPT
                    </button>
                  )}
                </div>
              </>
            )}
            <p className="mt-4 text-xs text-muted">
              Figures are checked again on saving. A blank or a figure out of range stops it, and says which.
            </p>
            <div className="mt-3 flex gap-2">
              <button className={ui.primary} onClick={() => void save()} disabled={!form.sku.trim()}>
                Save checked figures
              </button>
              <button className={ui.quiet} onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-[15px] font-medium text-ink">Your datasheets</h2>
        {sheets && sheets.length === 0 && <p className="mt-2 text-sm text-ink-2">None yet.</p>}
        <ul className="mt-2 space-y-2">
          {(sheets ?? []).map((s) => (
            <li key={`${s.kind}:${s.sku}`} className={clsx(ui.card, "flex flex-wrap items-start gap-3 px-4 py-3")}>
              <FileText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-medium">{s.sku}</span>{" "}
                  <span className="text-ink-2">· {s.kind === "panel" ? "Panel" : "Inverter"}</span>
                  {s.model && <span className="text-ink-2"> · {s.model}</span>}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">{summary(s)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Checked by {s.checkedBy.split("@")[0]} on {shortDate(s.checkedAt)}
                  {s.fileName && ` · from ${s.fileName}`}
                </p>
              </div>
              <button
                className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                aria-label={`Remove ${s.sku}'s figures`}
                onClick={async () => {
                  if (!window.confirm(`Remove the figures for ${s.sku}? The designer goes back to RENUABL's own, if it has any.`)) return;
                  const res = await deleteDatasheet(s.kind, s.sku);
                  if (res.ok) setSheets(res.sheets);
                  else setStatus({ ok: false, text: res.message });
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A saved sheet's figures in one line. */
function summary(s: SavedSheet): string {
  if (s.kind === "panel") {
    const p = s.figures as PanelElectrical;
    return `Voc ${p.voc} V · Vmp ${p.vmp} V · Isc ${p.isc} A · Imp ${p.imp} A · Voc ${(p.vocPerC * 100).toFixed(2)}%/°C`;
  }
  const i = s.figures as InverterElectrical;
  return `Max ${i.maxVoltage} V · MPPT ${i.mppMin}–${i.mppMax} V · start ${i.startVoltage} V · ${i.mppts.length} MPPT${i.mppts.length === 1 ? "" : "s"} (${i.mppts
    .map((m) => `${m.maxCurrent} A`)
    .join(", ")})`;
}
