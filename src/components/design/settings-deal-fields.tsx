"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  BUILTIN_FIELDS,
  CUSTOM_KINDS,
  KIND_LABELS,
  MAX_CUSTOM_FIELDS,
  MAX_TABS,
  cleanDealFields,
  type DealFieldsConfig,
  type FieldKind,
  type FieldSetting,
} from "@/lib/domain/design/deal-sections";
import { loadDealFields, saveDealFields } from "@/lib/services/crm";
import { ui } from "./design-shell";

const OURS = new Map(BUILTIN_FIELDS.map((f) => [f.key, f]));
const SOURCE_WORDS = { design: "From the design", known: "Filled in", typed: "" } as const;
const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10).padEnd(6, "0")}`;

/**
 * Settings → Deal fields: the business's own arrangement of a deal's fields (Martin: every business has its own
 * preferences). Tabs renamed, put in order, hidden or added; fields renamed, dragged (or moved up and down) into order,
 * hidden, moved to another tab, a dropdown's choices changed, and fields of its own added in six kinds. A figure the
 * deal fills in itself (from the design or the signed proposal) can be renamed, moved or hidden, never typed. Kept for
 * every member; values already typed on deals stay as they are.
 */
export function DealFieldsSettings() {
  const [config, setConfig] = useState<DealFieldsConfig | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [own, setOwn] = useState(false);
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ label: string; kind: FieldKind; options: string } | null>(null);

  useEffect(() => {
    void loadDealFields().then((res) => {
      if (!res.ok) return setStatus(res.message);
      setConfig(res.fields);
      setSaved(JSON.stringify(res.fields));
      setOwn(res.own);
    });
  }, []);
  if (!config) return <div className={ui.page}>{status && <p className="text-sm text-danger">{status}</p>}</div>;

  const changed = JSON.stringify(config) !== saved;
  const current = config.tabs[Math.min(tab, config.tabs.length - 1)];
  const at = Math.min(tab, config.tabs.length - 1);
  const customs = config.tabs.flatMap((t) => t.fields).filter((f) => !OURS.has(f.key)).length;
  const setTabs = (tabs: DealFieldsConfig["tabs"]) => setConfig({ tabs });
  const setFields = (fields: FieldSetting[]) => setTabs(config.tabs.map((t, i) => (i === at ? { ...t, fields } : t)));
  const setField = (i: number, change: Partial<FieldSetting>) =>
    setFields(current.fields.map((f, j) => (j === i ? { ...f, ...change } : f)));
  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= current.fields.length || from === to) return;
    const fields = [...current.fields];
    const [f] = fields.splice(from, 1);
    fields.splice(to, 0, f);
    setFields(fields);
  };
  const toTab = (i: number, target: number) => {
    const f = current.fields[i];
    setTabs(
      config.tabs.map((t, j) =>
        j === at ? { ...t, fields: t.fields.filter((_, k) => k !== i) } : j === target ? { ...t, fields: [...t.fields, f] } : t,
      ),
    );
  };
  const moveTab = (to: number) => {
    if (to < 0 || to >= config.tabs.length) return;
    const tabs = [...config.tabs];
    const [t] = tabs.splice(at, 1);
    tabs.splice(to, 0, t);
    setTabs(tabs);
    setTab(to);
  };
  const save = async (next: DealFieldsConfig | null) => {
    setStatus("Saving…");
    const res = await saveDealFields(next);
    if (!res.ok) return setStatus(res.message);
    setConfig(res.fields);
    setSaved(JSON.stringify(res.fields));
    setOwn(res.own);
    setStatus("Saved. Every deal shows its fields this way now.");
  };

  return (
    <div className={clsx(ui.page, "max-w-4xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Deal fields</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        The fields on every deal, in tabs, set up the way your business works. Rename them, drag them into the order you want, hide the ones
        you don&apos;t use, move them between tabs, change a dropdown&apos;s choices and add your own. Figures a deal fills in itself (from
        its design or its signed proposal) can be renamed, moved or hidden. What has already been typed on a deal is kept.
      </p>

      {/* The tabs, as the deal shows them, each picked to arrange its fields. */}
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {config.tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(i)}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
              i === at ? "bg-primary text-primary-ink" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
              t.hidden && "opacity-60",
            )}
          >
            {t.hidden && <EyeOff className="size-3.5" aria-hidden />}
            {t.label}
            <span className="text-xs tabular-nums opacity-70">{t.fields.filter((f) => !f.hidden).length}</span>
          </button>
        ))}
        {config.tabs.length < MAX_TABS && (
          <button
            className={clsx(ui.quiet, "h-9 px-3")}
            onClick={() => {
              setTabs([...config.tabs, { id: newId("t_"), label: "New tab", hidden: false, fields: [] }]);
              setTab(config.tabs.length);
            }}
          >
            <Plus className="size-4" aria-hidden /> Add a tab
          </button>
        )}
      </div>

      <section className={clsx(ui.card, "mt-4 p-5")}>
        <div className="flex flex-wrap items-end gap-3">
          <label className={clsx(ui.label, "w-56")}>
            Tab name
            <input
              className={clsx(ui.input, "mt-1.5")}
              value={current.label}
              maxLength={30}
              onChange={(e) => setTabs(config.tabs.map((t, i) => (i === at ? { ...t, label: e.target.value } : t)))}
            />
          </label>
          <div className="flex gap-1.5">
            <button
              className={clsx(ui.quiet, "h-10 px-3")}
              onClick={() => moveTab(at - 1)}
              disabled={at === 0}
              aria-label="Move the tab left"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              className={clsx(ui.quiet, "h-10 px-3")}
              onClick={() => moveTab(at + 1)}
              disabled={at === config.tabs.length - 1}
              aria-label="Move the tab right"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <button
              className={clsx(ui.quiet, "h-10 px-3")}
              onClick={() => setTabs(config.tabs.map((t, i) => (i === at ? { ...t, hidden: !t.hidden } : t)))}
            >
              {current.hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
              {current.hidden ? "Show the tab" : "Hide the tab"}
            </button>
            {config.tabs.length > 1 && (
              <button
                className={clsx(ui.quiet, "h-10 px-3 text-danger")}
                onClick={() => {
                  const own = current.fields.filter((f) => !OURS.has(f.key)).length;
                  if (
                    !window.confirm(
                      own
                        ? `Remove the "${current.label}" tab? Its ${own} field${own === 1 ? "" : "s"} of your own go with it; ours go back to their own tab.`
                        : `Remove the "${current.label}" tab? Its fields go back to their own tab.`,
                    )
                  )
                    return;
                  // Ours go back where they started when the arrangement is cleaned; the business's own go.
                  setConfig(cleanDealFields({ tabs: config.tabs.filter((_, i) => i !== at) }));
                  setTab(0);
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Remove
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-xs text-muted">Drag a field by its handle, or use the arrows, to put it in order.</p>
        <ul className="mt-2 divide-y divide-line rounded-md ring-1 ring-line">
          {current.fields.length === 0 && (
            <li className="px-4 py-6 text-sm text-ink-2">No fields in this tab yet. Add one below, or move one here.</li>
          )}
          {current.fields.map((f, i) => {
            const ours = OURS.get(f.key);
            const kind = ours?.kind ?? f.kind ?? "text";
            const choices = kind === "select" && (!ours || ours.source === "typed");
            return (
              <li
                key={f.key}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag !== null) moveField(drag, i);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={clsx("px-3 py-2.5", drag === i && "bg-surface-2", f.hidden && "bg-canvas")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted" aria-hidden />
                  <div className="w-full min-w-0 sm:w-64">
                    <input
                      aria-label="Field name"
                      className={clsx(ui.input, "h-9 min-h-9", f.hidden && "text-muted")}
                      value={f.label}
                      maxLength={60}
                      onChange={(e) => setField(i, { label: e.target.value })}
                    />
                  </div>
                  <span className="min-w-24 text-xs text-muted">
                    {ours ? SOURCE_WORDS[ours.source] || KIND_LABELS[ours.kind] : `${KIND_LABELS[kind]} · yours`}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <select
                      aria-label="Move to another tab"
                      className={clsx(ui.input, "h-8 min-h-8 w-36 appearance-auto text-xs")}
                      value={at}
                      onChange={(e) => toTab(i, Number(e.target.value))}
                    >
                      {config.tabs.map((t, j) => (
                        <option key={t.id} value={j}>
                          {j === at ? "In this tab" : `Move to ${t.label}`}
                        </option>
                      ))}
                    </select>
                    <IconButton label="Up" onClick={() => moveField(i, i - 1)} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton label="Down" onClick={() => moveField(i, i + 1)} disabled={i === current.fields.length - 1}>
                      <ArrowDown className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton label={f.hidden ? "Show" : "Hide"} onClick={() => setField(i, { hidden: !f.hidden })}>
                      {f.hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </IconButton>
                    {!ours && (
                      <IconButton
                        label="Remove"
                        onClick={() => {
                          if (window.confirm(`Remove "${f.label}"? What was typed in it on deals is no longer shown.`))
                            setFields(current.fields.filter((_, j) => j !== i));
                        }}
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </IconButton>
                    )}
                  </div>
                </div>
                {choices && (
                  <label className="mt-2 block pl-6 text-xs text-muted">
                    Choices, one a line
                    <textarea
                      className={clsx(ui.input, "mt-1 min-h-20 max-w-md py-1.5 text-[13px]")}
                      value={(f.options ?? ours?.options ?? []).join("\n")}
                      onChange={(e) => setField(i, { options: e.target.value.split("\n") })}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>

        {adding ? (
          <div className="mt-4 rounded-md border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className={clsx(ui.label, "w-64")}>
                Field name
                <input
                  className={clsx(ui.input, "mt-1.5")}
                  value={adding.label}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setAdding({ ...adding, label: e.target.value })}
                  placeholder="Roof colour, Referral from…"
                />
              </label>
              <label className={clsx(ui.label, "w-40")}>
                Kind
                <select
                  className={clsx(ui.input, "mt-1.5 appearance-auto")}
                  value={adding.kind}
                  onChange={(e) => setAdding({ ...adding, kind: e.target.value as FieldKind })}
                >
                  {CUSTOM_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {adding.kind === "select" && (
              <label className="mt-3 block text-xs text-muted">
                Choices, one a line
                <textarea
                  className={clsx(ui.input, "mt-1 min-h-20 max-w-md py-1.5 text-[13px]")}
                  value={adding.options}
                  onChange={(e) => setAdding({ ...adding, options: e.target.value })}
                />
              </label>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className={ui.primary}
                disabled={!adding.label.trim()}
                onClick={() => {
                  const options = adding.options
                    .split("\n")
                    .map((o) => o.trim())
                    .filter(Boolean);
                  setFields([
                    ...current.fields,
                    {
                      key: newId("c_"),
                      label: adding.label.trim(),
                      hidden: false,
                      kind: adding.kind,
                      ...(adding.kind === "select" ? { options: options.length ? options : ["Yes", "No"] } : {}),
                    },
                  ]);
                  setAdding(null);
                }}
              >
                Add the field
              </button>
              <button className={ui.quiet} onClick={() => setAdding(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          customs < MAX_CUSTOM_FIELDS && (
            <button className={clsx(ui.quiet, "mt-4")} onClick={() => setAdding({ label: "", kind: "text", options: "" })}>
              <Plus className="size-4" aria-hidden /> Add a field
            </button>
          )
        )}
      </section>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-canvas py-4">
        <button className={ui.primary} disabled={!changed} onClick={() => void save(config)}>
          Save
        </button>
        {changed && (
          <button className={ui.quiet} onClick={() => setConfig(JSON.parse(saved) as DealFieldsConfig)}>
            Undo changes
          </button>
        )}
        {own && (
          <button
            className={clsx(ui.quiet, "ml-auto")}
            onClick={() => {
              if (
                window.confirm(
                  "Go back to the fields as RENUABL sets them out? Your own fields are no longer shown; what was typed on deals is kept.",
                )
              )
                void save(null);
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Back to the standard fields
          </button>
        )}
        <p className="text-sm text-ink-2" role="status">
          {changed ? "Not saved yet." : status}
        </p>
      </div>
    </div>
  );
}

function IconButton(props: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink disabled:text-line"
    >
      {props.children}
    </button>
  );
}
