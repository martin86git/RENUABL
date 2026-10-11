"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import clsx from "clsx";
import { BLOCKS, isCustom, isLocked, moveBlock, type BlockSetting } from "@/lib/domain/design/blocks";
import {
  GST_MODES,
  INSTALL_TIMES,
  MAX_MILESTONES,
  MAX_NOTIFY,
  type BrandImage,
  type BrandKit,
  type Milestone,
} from "@/lib/domain/design/brand";
import { designAccount, type DesignAccount } from "@/lib/services/design-account";
import { addBrandImage, brandImageUrl, loadBrand, removeBrandImage, saveBrand } from "@/lib/services/proposals";
import { ui } from "./design-shell";
import { settingsPath } from "./settings-list";

export type ProposalPart = "payment" | "warranty" | "time" | "conditions" | "emails" | "customiser";

const TITLES: Record<ProposalPart, { title: string; intro: string }> = {
  payment: {
    title: "Payment terms and bank details",
    intro:
      "How your prices are written, what you ask for up front, when the rest falls due, and where a customer pays. Shown on every proposal you publish from now on, and in its PDF.",
  },
  warranty: {
    title: "Workmanship warranty",
    intro:
      "Your own warranty on your own work, as your customers will read it. It is your statement to your customer: RENUABL gives no warranty of its own on your installations.",
  },
  time: {
    title: "Installation time",
    intro: "How long installation usually takes from the day a customer goes ahead. Proposals show it as an estimate, never as a promise.",
  },
  conditions: {
    title: "Special conditions",
    intro:
      "Conditions of your own that go on every proposal. A customer going ahead accepts them, so they can't be switched off in the customiser.",
  },
  emails: {
    title: "Signed proposal emails",
    intro: "Extra addresses of your own to tell when a customer accepts a proposal.",
  },
  customiser: {
    title: "Proposal customiser",
    intro:
      "The blocks your proposals are made of. Switch a block on or off, move it up or down, and give it your own heading, words and a picture. The page your customer opens and the PDF both follow this.",
  },
};

const section = clsx(ui.card, "space-y-4 p-5 sm:p-6");
const h2 = "text-[17px] text-ink";
const help = "mt-0.5 block text-xs font-normal text-muted";

/**
 * The proposal's own settings, one to a page (payment terms and bank
 * details, the workmanship warranty, installation time, special conditions,
 * who is told when one is signed, and the block customiser). They are all
 * part of the business's brand kit, checked on the server before they are
 * kept (`cleanBrandKit`), and need the "changes prices and settings"
 * permission there. A proposal already sent stays as it was sent.
 */
export function ProposalSettings({ part }: { part: ProposalPart }) {
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [images, setImages] = useState<BrandImage[]>([]);
  const [emailReady, setEmailReady] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadBrand().then((res) => {
      if (gone) return;
      if (!res.ok) return setStatus({ text: res.message, error: true });
      setBrand(res.brand);
      setImages(res.images);
      setEmailReady(res.emailReady === true);
    });
    return () => {
      gone = true;
    };
  }, []);

  /** Sends one change. True when it was kept; otherwise the reason is shown and what is on the screen stays. */
  const save = async (patch: Partial<BrandKit>): Promise<boolean> => {
    const res = await saveBrand(patch);
    if (!res.ok) {
      setStatus({ text: res.message, error: true });
      return false;
    }
    setBrand(res.brand);
    setStatus({ text: "Saved" });
    return true;
  };

  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{TITLES[part].title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{TITLES[part].intro}</p>
        {status && (
          <p className={clsx("mt-2 text-sm", status.error ? "text-danger" : "text-positive")} role="status">
            {status.text}
          </p>
        )}
      </div>
      {!brand ? (
        !status && <p className="text-sm text-muted">Loading…</p>
      ) : part === "payment" ? (
        <Payment brand={brand} save={save} />
      ) : part === "warranty" ? (
        <Warranty brand={brand} save={save} />
      ) : part === "time" ? (
        <Timing brand={brand} save={save} />
      ) : part === "conditions" ? (
        <Conditions brand={brand} save={save} />
      ) : part === "emails" ? (
        <Emails brand={brand} save={save} emailReady={emailReady} />
      ) : (
        <Customiser
          brand={brand}
          save={save}
          images={images}
          setImages={setImages}
          onProblem={(text) => setStatus({ text, error: true })}
        />
      )}
    </div>
  );
}

interface PartProps {
  brand: BrandKit;
  save: (patch: Partial<BrandKit>) => Promise<boolean>;
}

/** GST, the deposit, payment milestones and bank details. The milestones and the bank details are saved with their own buttons: each has to be whole to be kept. */
function Payment({ brand, save }: PartProps) {
  const [deposit, setDeposit] = useState(brand.deposit);
  const [rows, setRows] = useState<{ percent: string; name: string }[]>(
    brand.milestones.map((m) => ({ percent: String(m.percent), name: m.name })),
  );
  const [bank, setBank] = useState(brand.bank);
  const total = Math.round(rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0) * 10) / 10;
  const filled = rows.filter((r) => r.name.trim() || Number(r.percent) > 0).length;
  const row = (i: number, patch: Partial<{ percent: string; name: string }>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const saveRows = () => void save({ milestones: rows.map((r) => ({ percent: Number(r.percent) || 0, name: r.name })) as Milestone[] });

  return (
    <>
      <section className={section} aria-labelledby="pay-gst">
        <h2 id="pay-gst" className={h2}>
          How prices are written
        </h2>
        <div className="space-y-1.5">
          {GST_MODES.map((mode) => (
            <label
              key={mode.id}
              className={clsx(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5",
                brand.gst === mode.id ? "border-ink bg-surface-2" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="gst"
                className="mt-1 accent-[var(--primary)]"
                checked={brand.gst === mode.id}
                onChange={() => void save({ gst: mode.id })}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{mode.name}</span>
                <span className="block text-xs text-muted">{mode.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Either way the price has GST in it: the quote builder adds 10% to every price. A price with no GST at all (for a business not
          registered for GST) isn&apos;t offered yet, because it changes how the quote is worked out, not only how it is written.
        </p>
      </section>

      <section className={section} aria-labelledby="pay-deposit">
        <h2 id="pay-deposit" className={h2}>
          Deposit
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className={ui.label}>
            Asked for up front
            <select
              className={clsx(ui.input, "mt-1.5 w-56 appearance-auto")}
              value={deposit.kind}
              onChange={(e) => {
                const kind = e.target.value as BrandKit["deposit"]["kind"];
                const next = { kind, amount: kind === "none" ? 0 : kind === "percent" ? 20 : 500 };
                setDeposit(next);
                void save({ deposit: next });
              }}
            >
              <option value="none">No deposit</option>
              <option value="percent">A percentage of the price</option>
              <option value="fixed">A fixed amount</option>
            </select>
          </label>
          {deposit.kind !== "none" && (
            <label className={ui.label}>
              {deposit.kind === "percent" ? "Percent" : "Dollars"}
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={deposit.kind === "percent" ? 100 : 1_000_000}
                className={clsx(ui.input, "mt-1.5 w-32 tabular-nums")}
                value={deposit.amount || ""}
                onChange={(e) => setDeposit({ ...deposit, amount: Number(e.target.value) })}
                onBlur={() => void save({ deposit })}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-muted">
          Worked out from what the customer pays, after the federal rebate. Nothing is charged through the proposal.
        </p>
      </section>

      <section className={section} aria-labelledby="pay-milestones">
        <h2 id="pay-milestones" className={h2}>
          Payment milestones
        </h2>
        <p className="text-sm text-ink-2">
          When each share of the price falls due. Leave it empty to say nothing, or make the shares add up to 100%.
        </p>
        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  aria-label={`Milestone ${i + 1}: percent due`}
                  className={clsx(ui.input, "w-24 tabular-nums")}
                  value={r.percent}
                  onChange={(e) => row(i, { percent: e.target.value })}
                />
                <span className="text-sm text-muted">%</span>
                <input
                  aria-label={`Milestone ${i + 1}: name`}
                  placeholder="e.g. Installation completion"
                  maxLength={60}
                  className={ui.input}
                  value={r.name}
                  onChange={(e) => row(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                  aria-label={`Remove milestone ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* The sum, said plainly: the server refuses anything but 100, and this is why before it is asked. */}
        {filled > 0 && (
          <p className={clsx("text-sm tabular-nums", total === 100 ? "text-positive" : "text-danger")} role="status">
            {total === 100 ? "These add up to 100%." : `These add up to ${total}%. They need to add up to 100% to be saved.`}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={ui.quiet}
            disabled={rows.length >= MAX_MILESTONES}
            onClick={() => setRows([...rows, { percent: "", name: "" }])}
          >
            <Plus className="size-4" aria-hidden /> Add a milestone
          </button>
          <button type="button" className={ui.primary} disabled={filled > 0 && total !== 100} onClick={saveRows}>
            Save milestones
          </button>
        </div>
      </section>

      <section className={section} aria-labelledby="pay-bank">
        <h2 id="pay-bank" className={h2}>
          Bank details
        </h2>
        <p className="text-sm text-ink-2">
          The account a customer pays into. Shown only on your own proposals and their PDFs, to whoever holds the proposal&apos;s private
          link. We never put them in an email. Leave all of it empty to show none.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={ui.label}>
            Account name
            <input
              className={clsx(ui.input, "mt-1.5")}
              value={bank.name}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setBank({ ...bank, name: e.target.value })}
            />
          </label>
          <label className={ui.label}>
            BSB
            <input
              className={clsx(ui.input, "mt-1.5 tabular-nums")}
              value={bank.bsb}
              inputMode="numeric"
              placeholder="6 digits"
              autoComplete="off"
              onChange={(e) => setBank({ ...bank, bsb: e.target.value })}
            />
          </label>
          <label className={ui.label}>
            Account number
            <input
              className={clsx(ui.input, "mt-1.5 tabular-nums")}
              value={bank.number}
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => setBank({ ...bank, number: e.target.value })}
            />
          </label>
          <label className={ui.label}>
            Payment reference (optional)
            <input
              className={clsx(ui.input, "mt-1.5")}
              value={bank.reference}
              maxLength={120}
              placeholder="e.g. Your surname and street"
              onChange={(e) => setBank({ ...bank, reference: e.target.value })}
            />
          </label>
        </div>
        <button type="button" className={ui.primary} onClick={() => void save({ bank }).then((kept) => kept && setBank((b) => ({ ...b })))}>
          Save bank details
        </button>
      </section>
    </>
  );
}

function Warranty({ brand, save }: PartProps) {
  return (
    <section className={section}>
      <label className={ui.label}>
        Workmanship warranty, in years
        <span className={help}>Leave it empty to state no period.</span>
        <input
          key={`years:${brand.warrantyYears}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          className={clsx(ui.input, "mt-1.5 w-32 tabular-nums")}
          defaultValue={brand.warrantyYears ?? ""}
          onBlur={(e) => {
            const typed = e.target.value.trim();
            if (typed !== String(brand.warrantyYears ?? "")) void save({ warrantyYears: typed === "" ? null : Number(typed) });
          }}
        />
      </label>
      <label className={ui.label}>
        Your warranty wording (optional)
        <span className={help}>What it covers, in your own words. Only say what you will stand behind: it is your promise, not ours.</span>
        <textarea
          key={`words:${brand.warrantyWords.length}`}
          rows={6}
          className={clsx(ui.input, "mt-1.5 py-2")}
          defaultValue={brand.warrantyWords}
          onBlur={(e) => e.target.value.trim() !== brand.warrantyWords && void save({ warrantyWords: e.target.value })}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted">
        On the proposal it reads as &ldquo;{brand.name}&apos;s workmanship warranty&rdquo;, with a line that products carry their
        manufacturers&apos; warranties.
      </p>
    </section>
  );
}

function Timing({ brand, save }: PartProps) {
  return (
    <section className={section}>
      <label className={ui.label}>
        Usual time from going ahead to installation
        <select
          className={clsx(ui.input, "mt-1.5 w-64 appearance-auto")}
          value={brand.installTime}
          onChange={(e) => void save({ installTime: e.target.value as BrandKit["installTime"] })}
        >
          {INSTALL_TIMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-muted">
        The proposal says this is an estimate of how long installation usually takes, and that the date is confirmed with the customer.
      </p>
    </section>
  );
}

function Conditions({ brand, save }: PartProps) {
  return (
    <section className={section}>
      <label className={ui.label}>
        Special conditions
        <span className={help}>
          Shown in a block of their own on every proposal and at the end of the PDF. With some here, the box a customer ticks to go ahead
          also says they accept them.
        </span>
        <textarea
          key={`conditions:${brand.conditions.length}`}
          rows={14}
          className={clsx(ui.input, "mt-1.5 py-2")}
          defaultValue={brand.conditions}
          onBlur={(e) => e.target.value.trim() !== brand.conditions && void save({ conditions: e.target.value })}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted">
        These are your words and your responsibility. Wording about warranties and payment that isn&apos;t a condition belongs under{" "}
        <Link href={settingsPath("wording")} className={ui.link}>
          About you and wording
        </Link>
        .
      </p>
    </section>
  );
}

function Emails({ brand, save, emailReady }: PartProps & { emailReady: boolean }) {
  return (
    <section className={section}>
      <label className={ui.label}>
        Also tell these addresses
        <span className={help}>One a line, up to {MAX_NOTIFY}. Your own people: an office inbox, whoever books installations.</span>
        <textarea
          key={`notify:${brand.notify.join("|")}`}
          rows={5}
          className={clsx(ui.input, "mt-1.5 py-2")}
          defaultValue={brand.notify.join("\n")}
          onBlur={(e) => {
            const lines = e.target.value
              .split(/[\n,;]+/)
              .map((l) => l.trim())
              .filter(Boolean);
            if (lines.join("\n") !== brand.notify.join("\n")) void save({ notify: lines });
          }}
        />
      </label>
      <div className="rounded-md border border-line bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
        <p className="font-medium text-ink">What is sent</p>
        <p className="mt-1">
          A short message from RENUABL, the moment a customer accepts: who accepted, which job, and a link to the deal. It doesn&apos;t
          carry the price, your bank details or a copy of the proposal, and it is never sent to the customer. We don&apos;t send email in
          your business&apos;s name. Acceptance is also written on the customer&apos;s record either way.
        </p>
        {!emailReady && (
          <p className="mt-2 font-medium text-sun-ink" role="status">
            Email isn&apos;t set up on this server, so nothing is sent from here yet. The addresses are kept for when it is.
          </p>
        )}
      </div>
    </section>
  );
}

/** The blocks, top to bottom as the proposal shows them. Each change is saved as it is made. */
function Customiser({
  brand,
  save,
  images,
  setImages,
  onProblem,
}: PartProps & { images: BrandImage[]; setImages: (images: BrandImage[]) => void; onProblem: (text: string) => void }) {
  const blocks = brand.blocks;
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const change = (id: string, patch: Partial<BlockSetting>) =>
    void save({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const upload = async (picked: File) => {
    const id = target.current;
    if (!id) return;
    setBusy(id);
    const res = await addBrandImage("block", picked);
    setBusy(null);
    if (file.current) file.current.value = "";
    if (!res.ok) return onProblem(res.message);
    // The picture it replaces is taken out of the kit (proposals already sent keep theirs), so the limit counts only what is in use.
    const before = blocks.find((b) => b.id === id)?.image;
    const after = before ? await removeBrandImage(before) : null;
    setImages(after?.ok ? after.images : res.images);
    change(id, { image: res.image.id });
  };
  const clearImage = async (block: BlockSetting) => {
    if (block.image) {
      const res = await removeBrandImage(block.image);
      if (res.ok) setImages(res.images);
    }
    change(block.id, { image: null });
  };

  return (
    <>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void upload(picked);
        }}
      />
      <ol className="space-y-2.5">
        {blocks.map((block, i) => {
          const kind = BLOCKS.find((b) => b.id === block.id)!;
          const locked = isLocked(block.id);
          const isOpen = open === block.id;
          const picture = block.image && images.find((image) => image.id === block.image);
          return (
            <li key={block.id} className={clsx(ui.card, "p-4", !block.on && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {block.heading || kind.name}
                    {block.heading && <span className="font-normal text-muted"> · {kind.name}</span>}
                  </p>
                  <p className="text-xs text-muted">{locked ? `${kind.about} Always shown.` : kind.about}</p>
                </div>
                <label className={clsx("flex items-center gap-2 text-xs font-medium", locked ? "text-muted" : "cursor-pointer text-ink-2")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={block.on}
                    disabled={locked}
                    onChange={(e) => change(block.id, { on: e.target.checked })}
                  />
                  Shown
                </label>
                <div className="flex">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 disabled:text-line-strong disabled:hover:bg-transparent"
                    aria-label={`Move ${kind.name} up`}
                    disabled={i <= 1}
                    onClick={() => void save({ blocks: moveBlock(blocks, block.id, -1) })}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 disabled:text-line-strong disabled:hover:bg-transparent"
                    aria-label={`Move ${kind.name} down`}
                    disabled={i === 0 || i === blocks.length - 1}
                    onClick={() => void save({ blocks: moveBlock(blocks, block.id, 1) })}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  className={clsx(ui.quiet, "h-9 px-3")}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : block.id)}
                >
                  {isOpen ? "Close" : "Edit"}
                </button>
              </div>
              {isOpen && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  {block.id !== "cover" && (
                    <label className={ui.label}>
                      Heading
                      <span className={help}>
                        {isCustom(block.id) ? "Your own heading for this block." : "Leave it empty for the usual heading."}
                      </span>
                      <input
                        key={`h:${block.heading}`}
                        className={clsx(ui.input, "mt-1.5")}
                        maxLength={80}
                        defaultValue={block.heading}
                        placeholder={kind.heading || undefined}
                        onBlur={(e) => e.target.value.trim() !== block.heading && change(block.id, { heading: e.target.value })}
                      />
                    </label>
                  )}
                  <label className={ui.label}>
                    Your words
                    <span className={help}>
                      Shown at the top of the block, before its figures. The notes that mark a figure as an estimate always stay.
                    </span>
                    <textarea
                      key={`w:${block.words.length}`}
                      rows={4}
                      className={clsx(ui.input, "mt-1.5 py-2")}
                      maxLength={1500}
                      defaultValue={block.words}
                      onBlur={(e) => e.target.value.trim() !== block.words && change(block.id, { words: e.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {picture && (
                      // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route at the size it was kept
                      <img src={brandImageUrl(picture.id)} alt="" className="h-20 w-28 rounded-md border border-line object-cover" />
                    )}
                    <button
                      type="button"
                      className={ui.quiet}
                      disabled={busy === block.id}
                      onClick={() => {
                        target.current = block.id;
                        file.current?.click();
                      }}
                    >
                      <Upload className="size-4" aria-hidden />{" "}
                      {busy === block.id ? "Uploading…" : picture ? "Replace the picture" : "Add a picture"}
                    </button>
                    {block.image && (
                      <button
                        type="button"
                        className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-danger"
                        onClick={() => void clearImage(block)}
                      >
                        Remove the picture
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs leading-relaxed text-muted">
        A block with nothing in it (no bill was entered, no payment terms are set) is left out of that proposal by itself. To see the
        result, open a deal&apos;s proposal: its preview follows these blocks.
      </p>
    </>
  );
}

/** Billing: what is true today, and nothing invented. */
export function BillingPage() {
  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Billing</h1>
      </div>
      <section className={section}>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-ink-2">Plan</dt>
            <dd className="text-ink">None: the product is in development</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-ink-2">What you pay</dt>
            <dd className="text-ink">Nothing</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">Payment method and invoices</dt>
            <dd className="text-ink">None: we hold no card or bank details for billing you</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-muted">
          There are no plans or prices yet, and you won&apos;t be charged without being told first and agreeing to it. When there is
          something to pay for, it will be set out here.
        </p>
      </section>
    </div>
  );
}

/**
 * Stands in for a pricing page when the signed-in person may not see costs:
 * the server sends them none, so the page would only show placeholders that
 * look like figures. Signed out (the designer tried on a device) and
 * everyone who may see costs get the page itself.
 */
export function NeedsCosts({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<DesignAccount | null>(null);
  useEffect(() => {
    let gone = false;
    void designAccount().then((a) => !gone && setAccount(a));
    return () => {
      gone = true;
    };
  }, []);
  if (!account) return <div className="min-h-[40dvh]" aria-busy="true" />;
  if (account.signedIn && account.may && !account.may.costs)
    return (
      <div className={clsx(ui.page, "max-w-3xl")}>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Prices</h1>
        <div className={clsx(ui.card, "mt-6 p-5 sm:p-6")}>
          <p className="text-sm leading-relaxed text-ink-2">
            You don&apos;t have access to costs and margin, so the business&apos;s prices aren&apos;t shown to you. The owner of the
            business can change that under Users and permissions.
          </p>
        </div>
      </div>
    );
  return <>{children}</>;
}
