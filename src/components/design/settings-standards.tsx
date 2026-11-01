"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import {
  LICENCE_LINE,
  OFFICIAL_SOURCES,
  OTHER_STANDARD,
  STANDARDS,
  STANDARD_GROUPS,
  copyLabel,
  standardInfo,
  type StandardCopy,
} from "@/lib/domain/design/standards";
import { shortDate } from "@/lib/services/crm";
import { loadStandards, removeStandard, standardHref, uploadStandard } from "@/lib/services/standards";
import { ui } from "./design-shell";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Settings → Standards and regulations: the business's own library of the standards it has bought (each member can
 * download them), what each covers, and the official places to read the rules or buy a copy. RENUABL holds no copy
 * of its own: Standards Australia sells them under licence.
 */
export function StandardsSettings() {
  const [copies, setCopies] = useState<StandardCopy[] | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState(STANDARDS[0].code);
  const [title, setTitle] = useState("");
  const [edition, setEdition] = useState("");
  const [licence, setLicence] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    void loadStandards().then((res) => (res.ok ? setCopies(res.copies) : setStatus({ ok: false, text: res.message })));
  }, []);

  const byCode = useMemo(() => {
    const map = new Map<string, StandardCopy[]>();
    for (const c of copies ?? []) map.set(c.code, [...(map.get(c.code) ?? []), c]);
    return map;
  }, [copies]);

  const upload = async () => {
    if (!file) return;
    setStatus(null);
    setSending(0);
    const res = await uploadStandard(file, { code, title, edition, licence }, setSending);
    setSending(null);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCopies(res.copies);
    setFile(null);
    setEdition("");
    setTitle("");
    setLicence(false);
    setStatus({ ok: true, text: "Added to your library. Everyone in your business can download it from here." });
  };

  const remove = async (c: StandardCopy) => {
    if (!window.confirm(`Remove ${copyLabel(c)} from your library?`)) return;
    const res = await removeStandard(c.id);
    if (res.ok) setCopies(res.copies);
    else setStatus({ ok: false, text: res.message });
  };

  return (
    <div className={clsx(ui.page, "max-w-4xl")}>
      <p className={ui.eyebrow}>Settings · Library</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Standards and regulations</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Keep the standards your business has bought here so everyone in your team can download them. Standards Australia sells them under
        licence, so RENUABL can&apos;t supply copies: upload the PDFs you hold, and buy any you don&apos;t from their store. Sol can tell
        your team which clause to look up, and points to your copy.
      </p>

      <section className={clsx(ui.card, "mt-5 p-5")}>
        <h2 className="text-[15px] font-medium text-ink">Add a copy</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <label className={ui.label}>
            Standard
            <select className={clsx(ui.input, "mt-1.5 appearance-auto")} value={code} onChange={(e) => setCode(e.target.value)}>
              {STANDARDS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.title}
                </option>
              ))}
              <option value={OTHER_STANDARD}>Something else (a guideline, a network&apos;s rules…)</option>
            </select>
          </label>
          <label className={ui.label}>
            Edition
            <input
              className={clsx(ui.input, "mt-1.5")}
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              placeholder="e.g. 2018, Amdt 2"
              maxLength={60}
            />
          </label>
        </div>
        {code === OTHER_STANDARD && (
          <label className={clsx(ui.label, "mt-3 block")}>
            What it is
            <input className={clsx(ui.input, "mt-1.5")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </label>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className={clsx(ui.quiet, "cursor-pointer")}>
            <FileText className="size-4" aria-hidden /> {file ? "Choose another PDF" : "Choose the PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-muted">{file ? `${file.name} · ${mb(file.size)}` : "A PDF, up to 60 MB."}</span>
        </div>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-2">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={licence} onChange={(e) => setLicence(e.target.checked)} />
          <span>{LICENCE_LINE}</span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={ui.primary}
            onClick={() => void upload()}
            disabled={!file || !licence || sending !== null || (code === OTHER_STANDARD && !title.trim())}
          >
            <Upload className="size-4" aria-hidden /> {sending !== null ? `Uploading… ${Math.round(sending * 100)}%` : "Add to library"}
          </button>
        </div>
        {status && <p className={clsx("mt-3 text-sm", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
      </section>

      {STANDARD_GROUPS.map((g) => (
        <section key={g.id} className="mt-6">
          <h2 className="text-[15px] font-medium text-ink">{g.label}</h2>
          <ul className="mt-2 space-y-2">
            {STANDARDS.filter((s) => s.group === g.id).map((s) => (
              <li key={s.code} className={clsx(ui.card, "px-4 py-3")}>
                <p className="text-sm text-ink">
                  <span className="font-medium">{s.code}</span> <span className="text-ink-2">· {s.title}</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.covers}</p>
                <Copies copies={byCode.get(s.code) ?? []} loaded={copies !== null} onRemove={remove} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(byCode.get(OTHER_STANDARD) ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-medium text-ink">Other documents</h2>
          <div className={clsx(ui.card, "mt-2 px-4 py-3")}>
            <Copies copies={byCode.get(OTHER_STANDARD) ?? []} loaded onRemove={remove} />
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-[15px] font-medium text-ink">Official sources</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {OFFICIAL_SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(ui.card, "block h-full px-4 py-3 transition-colors hover:border-ink/30")}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  {s.name} <ExternalLink className="size-3.5 text-muted" aria-hidden />
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{s.what}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Copies({ copies, loaded, onRemove }: { copies: StandardCopy[]; loaded: boolean; onRemove: (c: StandardCopy) => void }) {
  if (!loaded) return null;
  if (!copies.length) return <p className="mt-2 text-xs text-muted">No copy in your library yet.</p>;
  return (
    <ul className="mt-2 space-y-1.5">
      {copies.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-ink">
              {standardInfo(c.code) ? `${c.code}${c.edition ? `:${c.edition}` : ""}` : copyLabel(c)}
            </p>
            <p className="text-xs text-muted">
              {c.fileName} · {mb(c.size)} · added by {c.by.split("@")[0]} on {shortDate(c.at)}
            </p>
          </div>
          <a href={standardHref(c.id)} className={clsx(ui.quiet, "h-8 px-3 text-xs")} download>
            <Download className="size-3.5" aria-hidden /> Download
          </a>
          <button
            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-danger"
            aria-label={`Remove ${copyLabel(c)}`}
            onClick={() => onRemove(c)}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
