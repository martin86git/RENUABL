"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Copy, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import {
  FONTS,
  IMAGE_LIMITS,
  PALETTES,
  TEMPLATES,
  VALID_DAYS,
  themeVars,
  type BrandImage,
  type BrandKit,
  type ImageKind,
} from "@/lib/domain/design/brand";
import type { ProposalChoice, ProposalState, ProposalStatus, ProposalView } from "@/lib/domain/design/proposal";
import { dollars, shortDate } from "@/lib/services/crm";
import {
  addBrandImage,
  brandImageUrl,
  fullLink,
  loadBrand,
  loadProposal,
  previewProposal,
  proposalScreen,
  publishProposal,
  removeBrandImage,
  saveBrand,
  withdrawProposal,
} from "@/lib/services/proposals";
import { PATHS, ui } from "./design-shell";
import { CustomerChat } from "./chat-panel";
import { ProposalPage } from "./proposal-view";

const STATE_WORDS: Record<ProposalState, string> = {
  live: "With the customer",
  accepted: "Accepted",
  lapsed: "Price lapsed",
  withdrawn: "Withdrawn",
};

/** Where one version stands, in a line: "With the customer · opened 12 Oct 2026". */
function standing(p: ProposalStatus): string {
  if (p.state === "accepted") return `Accepted by ${p.acceptedName ?? "the customer"} on ${shortDate(p.acceptedAt ?? p.publishedAt)}`;
  if (p.state === "withdrawn") return "Withdrawn: the link shows only how to reach you";
  if (p.state === "lapsed") return `The price lapsed on ${shortDate(p.validUntil)}`;
  return p.openedAt ? `Opened by the customer on ${shortDate(p.openedAt)}` : "Not opened yet";
}

/** Copies a proposal's private link, in full, and says so for a moment. */
function CopyLink({ path, className }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className ?? ui.quiet}
      onClick={() => {
        void navigator.clipboard?.writeText(fullLink(path)).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy the customer's link"}
    </button>
  );
}

/**
 * The proposal block on a deal's page: whether one is out, where it stands,
 * and the way to the screen that previews and sends it.
 */
export function DealProposal({ jobId, hasDesign }: { jobId: string; hasDesign: boolean }) {
  const [versions, setVersions] = useState<ProposalStatus[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadProposal(jobId).then((res) => !gone && setVersions(res.ok ? res.versions : []));
    return () => {
      gone = true;
    };
  }, [jobId]);
  const latest = versions?.[0];
  return (
    <div className="border-t border-line px-5 py-4">
      <p className={ui.eyebrow}>Proposal</p>
      {latest ? (
        <>
          <p className="mt-1.5 text-sm text-ink">
            {STATE_WORDS[latest.state]} <span className="tabular-nums text-ink-2">· {dollars(latest.youPay)}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{standing(latest)}</p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          {hasDesign
            ? "None sent yet. It is worked out from the saved design and your prices."
            : "Design the roof first: a proposal is worked out from the design."}
        </p>
      )}
      <Link
        href={proposalScreen(jobId)}
        className={clsx(ui.quiet, "mt-3 w-full", !hasDesign && "pointer-events-none text-muted")}
        aria-disabled={!hasDesign}
      >
        <FileText className="size-4" aria-hidden /> {latest ? "View proposal" : "Create proposal"}
      </Link>
    </div>
  );
}

/**
 * Previewing and sending a deal's proposal (/design/deals/<id>/proposal).
 * Down the left, the three choices (template, how long the price stands, a
 * note), what has been sent and its private link; beside them, the proposal
 * exactly as the customer will see it. Every figure in the preview is worked
 * out on the server from the saved design: this screen never holds a cost.
 */
export function ProposalStudio({ jobId }: { jobId: string }) {
  const [choice, setChoice] = useState<Partial<ProposalChoice>>({});
  const [view, setView] = useState<ProposalView | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [projectVersion, setProjectVersion] = useState<number | null>(null);
  const [versions, setVersions] = useState<ProposalStatus[]>([]);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const latest = versions[0];

  // The preview follows the choices, a moment after the last change (the note is typed a letter at a time).
  const asked = useRef(0);
  const refresh = useCallback(
    async (next: Partial<ProposalChoice>) => {
      const mine = ++asked.current;
      const res = await previewProposal(jobId, next);
      if (mine !== asked.current) return;
      setLoaded(true);
      if (!res.ok) return setStatus({ text: res.message, error: true });
      setView(res.view);
      setProblems(res.problems);
      setProjectVersion(res.projectVersion);
      if (res.choice) setChoice((current) => ({ ...res.choice, ...current }));
    },
    [jobId],
  );
  useEffect(() => {
    // The first preview is asked of the server: its state is set when the answer arrives, not in the effect itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh({});
    void loadProposal(jobId).then((res) => res.ok && setVersions(res.versions));
  }, [jobId, refresh]);
  const change = (patch: Partial<ProposalChoice>) => {
    const next = { ...choice, ...patch };
    setChoice(next);
    const mine = ++asked.current;
    window.setTimeout(() => mine === asked.current && void refresh(next), "note" in patch ? 500 : 0);
  };

  const publish = async () => {
    if (projectVersion === null) return;
    if (
      latest?.state === "accepted" &&
      !window.confirm("The customer has accepted the proposal they were sent. Send a new version in its place?")
    )
      return;
    setBusy(true);
    const res = await publishProposal(jobId, { ...choice, projectVersion });
    setBusy(false);
    if (!res.ok) return setStatus({ text: res.message, error: true });
    setVersions(res.versions);
    setStatus({ text: "Published. Copy the link and send it to your customer: we don't email it for you." });
  };
  const withdraw = async () => {
    if (!window.confirm("Take this proposal back? Its link will then show only how to reach you.")) return;
    const res = await withdrawProposal(jobId);
    if (!res.ok) return setStatus({ text: res.message, error: true });
    setVersions(res.versions);
    setStatus({ text: "Withdrawn." });
  };
  const out = latest && latest.state !== "withdrawn";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-line bg-surface lg:w-[340px] lg:border-b-0 lg:border-r" aria-label="Proposal">
        <div className="space-y-5 px-5 py-5">
          <Link href={`${PATHS.deals}/${jobId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline">
            <ChevronLeft className="size-4" aria-hidden /> Back to the deal
          </Link>
          <div>
            <p className={ui.eyebrow}>Proposal</p>
            <h1 className="mt-1 text-[20px] leading-snug tracking-tight text-ink">Preview and send</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Worked out from the saved design, the customer&apos;s bill and your prices. Your costs and margin are never in it.
            </p>
          </div>

          {status && (
            <p className={clsx("text-sm", status.error ? "text-danger" : "text-positive")} role="status">
              {status.text}
            </p>
          )}
          {problems.length > 0 && (
            <div className="rounded-md border border-sun-line bg-sun p-3 text-sm text-sun-ink" role="alert">
              <p className="font-medium">It can&apos;t be sent yet</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href={`${PATHS.designer}?job=${jobId}`} className="mt-2 inline-block font-medium underline underline-offset-4">
                Open the design
              </Link>
            </div>
          )}

          <fieldset>
            <legend className={ui.label}>Template</legend>
            <div className="mt-1.5 space-y-1.5">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5",
                    choice.template === t.id ? "border-ink bg-surface-2" : "border-line hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    className="mt-1 accent-[var(--primary)]"
                    checked={choice.template === t.id}
                    onChange={() => change({ template: t.id })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">{t.name}</span>
                    <span className="block text-xs text-muted">{t.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={ui.label}>
            The price stands for
            <select
              className={clsx(ui.input, "mt-1.5 appearance-auto")}
              value={choice.validDays ?? ""}
              onChange={(e) => change({ validDays: Number(e.target.value) as ProposalChoice["validDays"] })}
            >
              {VALID_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>

          <label className={ui.label}>
            A note to the customer (optional)
            <textarea
              className={clsx(ui.input, "mt-1.5 min-h-24 py-2")}
              maxLength={1200}
              value={choice.note ?? ""}
              onChange={(e) => change({ note: e.target.value })}
            />
          </label>

          <button
            type="button"
            className={clsx(ui.primary, "w-full")}
            disabled={busy || !view || projectVersion === null}
            onClick={() => void publish()}
          >
            {busy
              ? "Publishing…"
              : out
                ? latest.openedAt || latest.acceptedAt
                  ? "Publish a new version"
                  : "Publish these changes"
                : "Publish"}
          </button>
          <p className="text-xs leading-relaxed text-muted">
            Publishing keeps a fixed copy at a private link. Nobody is emailed: you send the link. Colours, logo and wording come from{" "}
            <Link href={PATHS.brand} className={ui.link}>
              your proposal branding
            </Link>
            .
          </p>

          {latest && (
            <div className="space-y-2.5 border-t border-line pt-4">
              <p className={ui.eyebrow}>Sent</p>
              <p className="text-sm text-ink">
                {STATE_WORDS[latest.state]} <span className="tabular-nums text-ink-2">· {dollars(latest.youPay)}</span>
              </p>
              <p className="text-xs text-muted">
                {latest.version > 1 ? `Version ${latest.version}, published` : "Published"} {shortDate(latest.publishedAt)}.{" "}
                {standing(latest)}.{latest.state === "live" ? ` The price stands until ${shortDate(latest.validUntil)}.` : ""}
              </p>
              {out && (
                <>
                  <CopyLink path={latest.path} className={clsx(ui.quiet, "w-full")} />
                  <a href={latest.path} target="_blank" rel="noreferrer" className={clsx(ui.quiet, "w-full")}>
                    <ExternalLink className="size-4" aria-hidden /> Open it as the customer sees it
                  </a>
                  <button
                    type="button"
                    onClick={() => void withdraw()}
                    className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-danger"
                  >
                    Take it back
                  </button>
                </>
              )}
              {versions.length > 1 && (
                <ul className="space-y-1 pt-1 text-xs text-muted">
                  {versions.slice(1).map((v) => (
                    <li key={v.version}>
                      Version {v.version} · {shortDate(v.publishedAt)} · {dollars(v.youPay)}
                      {v.acceptedAt ? " · accepted" : v.openedAt ? " · opened" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-surface-2 p-3 sm:p-6">
        {view ? (
          <div className="mx-auto max-w-4xl overflow-hidden rounded-lg shadow-[var(--shadow-lift)] ring-1 ring-line">
            <ProposalPage
              view={view}
              state="live"
              accepted={null}
              urls={{
                image: brandImageUrl,
                roof: `/api/design/roof?lat=${view.roof.lat.toFixed(6)}&lng=${view.roof.lng.toFixed(6)}`,
                pdf: null,
              }}
              chat={<CustomerChat business={view.business.name} phone={view.business.phone} />}
            />
          </div>
        ) : (
          <p className="px-4 py-16 text-center text-sm text-muted">
            {loaded ? "There is nothing to preview yet. See what's needed on the left." : "Working the proposal out…"}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

const KIND_WORDS: Record<ImageKind, { title: string; help: string }> = {
  logo: { title: "Logo", help: "Shown at the top of every proposal and in the PDF. A PNG with a see-through background works best." },
  cover: { title: "Cover photo", help: "Across the top of the Classic template and the PDF's first page. A wide photo of your work." },
  photo: { title: "Photos", help: `Up to ${IMAGE_LIMITS.photos}, shown under "About". Your team, your installations.` },
  block: { title: "Block pictures", help: "Pictures for the proposal's blocks. They are added from the proposal customiser." },
};

/** One picture slot (or the photos): what is there, the way to add one, the way to take one out. */
function Pictures(props: {
  kind: ImageKind;
  images: BrandImage[];
  onChange: (images: BrandImage[]) => void;
  onProblem: (text: string) => void;
}) {
  const mine = props.images.filter((i) => i.kind === props.kind);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = props.kind === "photo" && mine.length >= IMAGE_LIMITS.photos;
  const add = async (file: File) => {
    setBusy(true);
    const res = await addBrandImage(props.kind, file);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (res.ok) props.onChange(res.images);
    else props.onProblem(res.message);
  };
  const remove = async (id: string) => {
    const res = await removeBrandImage(id);
    if (res.ok) props.onChange(res.images);
    else props.onProblem(res.message);
  };
  return (
    <div>
      <p className="text-sm font-medium text-ink">{KIND_WORDS[props.kind].title}</p>
      <p className="mt-0.5 text-xs text-muted">{KIND_WORDS[props.kind].help}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {mine.map((image) => (
          <div key={image.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route at the size it was kept */}
            <img
              src={brandImageUrl(image.id)}
              alt=""
              className={clsx(
                "h-20 rounded-md border border-line bg-surface-2",
                props.kind === "logo" ? "w-auto max-w-44 object-contain p-2" : "w-28 object-cover",
              )}
            />
            <button
              type="button"
              onClick={() => void remove(image.id)}
              className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-danger"
              aria-label={`Remove this ${props.kind === "photo" ? "photo" : props.kind}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id={`brand-${props.kind}`}
          disabled={busy || full}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void add(file);
          }}
        />
        <label
          htmlFor={`brand-${props.kind}`}
          className={clsx(ui.quiet, "cursor-pointer", (busy || full) && "pointer-events-none text-muted")}
        >
          <Upload className="size-4" aria-hidden /> {busy ? "Uploading…" : mine.length && props.kind !== "photo" ? "Replace" : "Upload"}
        </label>
      </div>
    </div>
  );
}

/**
 * A business's branding for its proposals (/design/settings/brand): who it
 * is and how to reach it, its licences, its own words, its pictures, and the
 * template and colours its proposals use. Each field saves as it is left;
 * the swatch beside the colours shows how they will read together.
 */
export function BrandSettings({ part }: { part: "who" | "look" | "words" }) {
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [images, setImages] = useState<BrandImage[]>([]);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadBrand().then((res) => {
      if (gone) return;
      if (!res.ok) return setStatus({ text: res.message, error: true });
      setBrand(res.brand);
      setImages(res.images);
    });
    return () => {
      gone = true;
    };
  }, []);

  const save = async (patch: Partial<BrandKit>) => {
    const res = await saveBrand(patch);
    if (!res.ok) return setStatus({ text: res.message, error: true });
    setBrand(res.brand);
    setStatus({ text: "Saved" });
  };
  if (!brand)
    return (
      <div className={ui.page}>
        <p className={clsx("text-sm", status?.error ? "text-danger" : "text-muted")}>{status?.text ?? "Loading…"}</p>
      </div>
    );

  /** A box that keeps what is typed and saves when it is left, if it changed. */
  const text = (
    key: "name" | "tagline" | "phone" | "email" | "website" | "address" | "abn",
    label: string,
    more?: { placeholder?: string; type?: string },
  ) => (
    <label className={ui.label}>
      {label}
      <input
        key={`${key}:${brand[key]}`}
        className={clsx(ui.input, "mt-1.5")}
        defaultValue={brand[key]}
        type={more?.type ?? "text"}
        placeholder={more?.placeholder}
        onBlur={(e) => e.target.value.trim() !== brand[key] && void save({ [key]: e.target.value })}
      />
    </label>
  );
  const long = (key: "about" | "extra" | "conditions", label: string, help: string, rows: number) => (
    <label className={ui.label}>
      {label}
      <span className="mt-0.5 block text-xs font-normal text-muted">{help}</span>
      <textarea
        key={`${key}:${brand[key].length}`}
        className={clsx(ui.input, "mt-1.5 py-2")}
        rows={rows}
        defaultValue={brand[key]}
        onBlur={(e) => e.target.value.trim() !== brand[key] && void save({ [key]: e.target.value })}
      />
    </label>
  );
  const list = (key: "licences" | "points", label: string, help: string) => (
    <label className={ui.label}>
      {label}
      <span className="mt-0.5 block text-xs font-normal text-muted">{help}</span>
      <textarea
        key={`${key}:${brand[key].join("|")}`}
        className={clsx(ui.input, "mt-1.5 py-2")}
        rows={key === "points" ? 5 : 4}
        defaultValue={brand[key].join("\n")}
        onBlur={(e) => {
          const lines = e.target.value
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.join("\n") !== brand[key].join("\n")) void save({ [key]: lines });
        }}
      />
    </label>
  );
  const section = clsx(ui.card, "space-y-4 p-5 sm:p-6");

  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">
          {part === "who" ? "Company details" : part === "look" ? "Logo, theme, colours and fonts" : "About you and wording"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Your proposals go to your customers under your name, logo and colours. What you set here is used by the next proposal you publish;
          proposals already sent stay as they were sent.
        </p>
        {status && (
          <p className={clsx("mt-2 text-sm", status.error ? "text-danger" : "text-positive")} role="status">
            {status.text}
          </p>
        )}
      </div>

      <section hidden={part !== "who"} className={section} aria-labelledby="brand-who">
        <h2 id="brand-who" className="text-[17px] text-ink">
          Your business
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Trading name")}
          {text("tagline", "Tagline (optional)")}
          {text("phone", "Phone", { type: "tel" })}
          {text("email", "Email", { type: "email" })}
          {text("website", "Website", { placeholder: "example.com.au" })}
          {text("abn", "ABN", { placeholder: "11 digits" })}
        </div>
        {text("address", "Business address")}
        {list(
          "licences",
          "Licence and accreditation lines",
          "One a line, up to four, as you want them shown. For example your electrical licence number.",
        )}
      </section>

      <section hidden={part !== "look"} className={section} aria-labelledby="brand-look">
        <h2 id="brand-look" className="text-[17px] text-ink">
          Look
        </h2>
        <Pictures kind="logo" images={images} onChange={setImages} onProblem={(t) => setStatus({ text: t, error: true })} />
        <Pictures kind="cover" images={images} onChange={setImages} onProblem={(t) => setStatus({ text: t, error: true })} />
        <Pictures kind="photo" images={images} onChange={setImages} onProblem={(t) => setStatus({ text: t, error: true })} />
        <p className="text-xs text-muted">JPEG, PNG or WebP, up to 5 MB each. We keep a smaller copy of the picture only.</p>

        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <label className={ui.label}>
            Type
            <select
              className={clsx(ui.input, "mt-1.5 appearance-auto")}
              value={brand.font}
              onChange={(e) => void save({ font: e.target.value as BrandKit["font"] })}
            >
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}: {f.blurb} {f.pdf}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Usual template
            <select
              className={clsx(ui.input, "mt-1.5 appearance-auto")}
              value={brand.template}
              onChange={(e) => void save({ template: e.target.value as BrandKit["template"] })}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}: {t.blurb}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Page
            <select
              className={clsx(ui.input, "mt-1.5 appearance-auto")}
              value={brand.palette}
              onChange={(e) => void save({ palette: e.target.value as BrandKit["palette"] })}
            >
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Your main colour
            <input
              type="color"
              className="mt-1.5 block h-10 w-full cursor-pointer rounded-md border border-line bg-surface p-1"
              defaultValue={brand.primary}
              key={`primary:${brand.primary}`}
              onBlur={(e) => e.target.value !== brand.primary && void save({ primary: e.target.value })}
            />
          </label>
          <label className={ui.label}>
            Your second colour
            <input
              type="color"
              className="mt-1.5 block h-10 w-full cursor-pointer rounded-md border border-line bg-surface p-1"
              defaultValue={brand.accent}
              key={`accent:${brand.accent}`}
              onBlur={(e) => e.target.value !== brand.accent && void save({ accent: e.target.value })}
            />
          </label>
          <label className={ui.label}>
            A price usually stands for
            <select
              className={clsx(ui.input, "mt-1.5 appearance-auto")}
              value={brand.validDays}
              onChange={(e) => void save({ validDays: Number(e.target.value) as BrandKit["validDays"] })}
            >
              {VALID_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* How the colours read together, on the page chosen: the text on the main colour is picked for you so it can always be read. */}
        <div
          style={themeVars(brand) as React.CSSProperties}
          className="rounded-lg border border-line bg-canvas p-4"
          aria-label="How your colours look"
        >
          <div className="rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-ink">{brand.name}</div>
          <div className="mt-3 rounded-md border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink">Your system</p>
            <p className="text-xs text-muted">How text and cards look on this page.</p>
          </div>
        </div>
      </section>

      <section hidden={part !== "words"} className={section} aria-labelledby="brand-words">
        <h2 id="brand-words" className="text-[17px] text-ink">
          Your words
        </h2>
        {long("about", "About your business", "A few sentences, in your own words. Only say what you can stand behind.", 5)}
        {list("points", "Reasons to choose you", "One a line, up to five.")}
        {long(
          "extra",
          "Anything else to say under the price",
          "Shown under the price on every proposal: what happens next, what to expect.",
          5,
        )}
        <p className="text-xs text-muted">
          Payment terms, your workmanship warranty and your special conditions each have a page of their own in Settings.
        </p>
      </section>
    </div>
  );
}
