"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Search, Trash2, Upload } from "lucide-react";
import { KEEP_SHEET_BYTES } from "@/lib/domain/design/datasheets";
import { DOC_KIND_WORDS, type DocKind } from "@/lib/domain/design/proposal-datasheets";
import { chargersOf, workspaceCatalogue } from "@/lib/domain/design/pricing";
import { shortDate } from "@/lib/services/crm";
import {
  confirmDatasheet,
  deleteProductFile,
  findQuotedOnline,
  keepProductFile,
  loadDatasheets,
  productFileHref,
  type SavedFile,
} from "@/lib/services/datasheets";
import { loadWorkspace } from "@/lib/services/design-store";
import { ui } from "./design-shell";

type FileKind = Extract<DocKind, "battery" | "charger">;
type Product = { kind: FileKind; sku: string; name: string };

/**
 * Settings → Product datasheets → Batteries and EV chargers (26 Nov 2026, Martin: every quoted product's datasheet with
 * the proposal). A battery's or charger's sheet is kept as a file alone (its figures aren't read): uploaded here, or
 * found online, and from then on it goes with every proposal that quotes that product.
 */
export function ProductFileSettings(props: { mayChange: boolean }) {
  const [files, setFiles] = useState<SavedFile[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [kind, setKind] = useState<FileKind>("battery");
  const [sku, setSku] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = () => void loadDatasheets().then((res) => res.ok && setFiles(res.files ?? []));
  useEffect(() => {
    reload();
    void loadWorkspace()
      .then((w) => {
        const c = workspaceCatalogue(w);
        setProducts([
          ...(c.batteries ?? []).map((b) => ({ kind: "battery" as const, sku: b.sku, name: b.name })),
          ...chargersOf(w).map((x) => ({ kind: "charger" as const, sku: x.sku, name: x.name })),
        ]);
      })
      .catch(() => undefined);
  }, []);

  const have = useMemo(() => new Set((files ?? []).map((f) => `${f.kind}:${f.sku}`)), [files]);
  const missing = products.filter((p) => !have.has(`${p.kind}:${p.sku}`));
  const choices = products.filter((p) => p.kind === kind);
  const picked = choices.find((p) => p.sku === sku) ?? null;

  const upload = async (file: File) => {
    if (!sku.trim()) return setStatus({ ok: false, text: "Choose the product, or type its code as it is on your price list." });
    if (file.size > KEEP_SHEET_BYTES) return setStatus({ ok: false, text: "That sheet is over 4 MB. Keep a smaller copy." });
    setBusy("upload");
    const res = await keepProductFile(kind, sku.trim(), picked?.name ?? sku.trim(), file);
    setBusy(null);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setFiles(res.files);
    setSku("");
    setStatus({ ok: true, text: "Kept. It goes with every proposal that quotes this product." });
  };

  const findAll = async () => {
    setBusy("find");
    setStatus(null);
    const res = await findQuotedOnline(missing.slice(0, 6));
    setBusy(null);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setStatus({
      ok: res.found > 0,
      text: res.found ? `Found ${res.found} online, marked to check.` : "Couldn't find them online. Upload them here.",
    });
    reload();
  };

  return (
    <section className="mt-10" aria-labelledby="product-files">
      <h2 id="product-files" className="text-[18px] tracking-tight text-ink">
        Batteries and EV chargers
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        Their datasheets are kept as files, to open again and to go with every proposal that quotes them. A panel&apos;s and an
        inverter&apos;s go with proposals too, from the list above.
      </p>

      {missing.length > 0 && (
        <div className="mt-4 rounded-md bg-sun px-4 py-3 text-sm text-sun-ink">
          <p className="font-medium">
            {missing.length} batter{missing.length === 1 ? "y or charger" : "ies and chargers"} on your price lists have no datasheet yet
          </p>
          <p className="mt-1 text-[13px]">
            {missing
              .slice(0, 6)
              .map((p) => p.name)
              .join(", ")}
            {missing.length > 6 ? ` and ${missing.length - 6} more` : ""}
          </p>
          <button
            type="button"
            onClick={() => void findAll()}
            disabled={busy !== null}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white disabled:bg-line disabled:text-muted"
          >
            <Search className="size-3.5" aria-hidden />
            {busy === "find" ? "Looking online…" : `Find ${Math.min(6, missing.length) === missing.length ? "them" : "six"} online`}
          </button>
        </div>
      )}

      {props.mayChange && (
        <div className="mt-4 grid gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className={ui.label}>What it is</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as FileKind);
                setSku("");
              }}
              className={ui.input}
            >
              <option value="battery">{DOC_KIND_WORDS.battery}</option>
              <option value="charger">{DOC_KIND_WORDS.charger}</option>
            </select>
          </label>
          <label className="block">
            <span className={ui.label}>Product code, as on your price list</span>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              list="product-file-codes"
              placeholder={choices[0]?.sku ?? "e.g. SIGEN-BAT-8.0"}
              className={ui.input}
            />
            <datalist id="product-file-codes">
              {choices.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name}
                </option>
              ))}
            </datalist>
          </label>
          <label
            className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            <Upload className="size-4" aria-hidden />
            {busy === "upload" ? "Keeping…" : "Upload the sheet"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </label>
        </div>
      )}

      {status && (
        <p role="status" className={`mt-3 text-sm ${status.ok ? "text-positive" : "text-danger"}`}>
          {status.text}
        </p>
      )}

      <ul className="mt-4 divide-y divide-line rounded-md border border-line bg-surface">
        {files === null && <li className="px-4 py-3 text-sm text-muted">Loading…</li>}
        {files?.length === 0 && <li className="px-4 py-3 text-sm text-muted">No battery or EV charger datasheets yet.</li>}
        {files?.map((f) => (
          <li key={`${f.kind}:${f.sku}`} className="flex items-center gap-3 px-4 py-3">
            <FileText className="size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate text-ink">
                <span className="text-muted">{DOC_KIND_WORDS[f.kind]} · </span>
                {f.model || f.sku}
                <span className="text-muted"> · {f.sku}</span>
              </p>
              <p className="text-[12px] text-muted">
                {f.shared ? "Shared by another business on RENUABL" : f.foundUrl ? "Found online" : `Kept by ${f.checkedBy.split("@")[0]}`}
                {" · "}
                {shortDate(f.checkedAt.slice(0, 10))}
                {f.unchecked && " · to check"}
              </p>
            </div>
            <a
              href={productFileHref(f.kind, f.sku)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium underline"
            >
              Open
            </a>
            {props.mayChange && f.unchecked && (
              <button
                type="button"
                className="text-[13px] font-medium underline"
                onClick={async () => {
                  const res = await confirmDatasheet(f.kind, f.sku);
                  if (!res.ok) return setStatus({ ok: false, text: res.message });
                  reload();
                }}
              >
                It&apos;s the right sheet
              </button>
            )}
            {props.mayChange && !f.shared && (
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                aria-label={`Remove the datasheet for ${f.sku}`}
                onClick={async () => {
                  if (!window.confirm(`Remove the datasheet for ${f.sku}? It stops going with proposals.`)) return;
                  const res = await deleteProductFile(f.kind, f.sku);
                  if (res.ok) setFiles(res.files);
                  else setStatus({ ok: false, text: res.message });
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
