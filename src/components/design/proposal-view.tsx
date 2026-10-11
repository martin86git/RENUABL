"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Download } from "lucide-react";
import { blockHeading, viewBlocks, type BlockId, type ViewBlock } from "@/lib/domain/design/blocks";
import { shownAbn, shownBsb, shownWebsite, themeVars } from "@/lib/domain/design/brand";
import {
  BANK_NOTE,
  acceptLine,
  contractDetails,
  ESTIMATE_NOTE,
  NO_SUNSHINE_NOTE,
  PRODUCTION_NOTE,
  ROOF_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  TIMING_NOTE,
  warrantyNote,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import { ROOF_IMAGE, metresPerPixel } from "@/lib/domain/design/roof-design";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
/** "3 November 2026" from a day or a moment. A bare day is that day wherever it is read. */
const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "Australia/Melbourne",
  });

const card = "rounded-xl border border-line bg-surface p-5 sm:p-7";
const eyebrow = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";
// Headings are set in the face the business chose (`--proposal-heading`, from `themeVars`).
const h2 = "text-[22px] leading-tight tracking-tight text-ink [font-family:var(--proposal-heading)] sm:text-[26px]";
const fine = "text-[12.5px] leading-relaxed text-muted";
const field =
  "block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink outline-none focus:border-[var(--primary)] sm:text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted";

/** Where a proposal's pictures and files are fetched from: the customer's link, or the business's own preview. */
export interface ProposalUrls {
  image: (id: string) => string;
  /** The roof from above. Null in a preview with no picture to show: the layout is then drawn on a plain ground. */
  roof: string | null;
  /** Null in a preview: there is no file until it is published. */
  pdf: string | null;
}

/** What the customer can do from the page. Left out in the business's preview, where the buttons are shown but do nothing. */
export interface ProposalActions {
  accept: (name: string, agree: boolean) => Promise<string | null>;
  ask: (text: string) => Promise<string | null>;
}

/** The roof from above with the panels where they were placed: the same picture and scale the design was drawn on. */
function Roof({ view, src }: { view: ProposalView; src: string | null }) {
  // The picture is shown only once it is known to have come: a picture that can't be had (no map service here, or
  // the place has none) must leave the plain ground, not a broken image.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!src) return;
    const probe = new Image();
    probe.onload = () => setArrived(true);
    probe.src = src;
    return () => {
      probe.onload = null;
    };
  }, [src]);
  const scale = metresPerPixel(view.roof.lat);
  const { width, height } = ROOF_IMAGE;
  const at = (x: number, y: number) => `${(width / 2 + x / scale).toFixed(1)},${(height / 2 + y / scale).toFixed(1)}`;
  return (
    // A dark ground under the picture, so the layout still reads when the picture from above can't be had.
    <div className="overflow-hidden rounded-lg border border-line bg-ink">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${view.system.panels} panels on the roof, seen from above`}
      >
        {src && arrived && <image href={src} width={width} height={height} preserveAspectRatio="xMidYMid slice" />}
        {view.roof.panels.map((p, i) => (
          <polygon
            key={i}
            points={[0, 2, 4, 6].map((k) => at(p[k], p[k + 1])).join(" ")}
            fill="rgb(17 24 39 / 0.82)"
            stroke="rgb(255 255 255 / 0.85)"
            strokeWidth={0.8}
          />
        ))}
      </svg>
    </div>
  );
}

/** The year month by month: each month's estimate as a bar against the best month. */
function Months({ kwh }: { kwh: number[] }) {
  const top = Math.max(1, ...kwh);
  return (
    <div className="flex h-36 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Estimated output for each month of the year">
      {kwh.map((m, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div
            className="w-full rounded-t bg-primary"
            style={{ height: `${Math.max(2, (m / top) * 100)}%` }}
            title={`${m.toLocaleString("en-AU")} kWh`}
          />
          <span className="text-[10.5px] text-muted">{MONTHS[i]}</span>
        </div>
      ))}
    </div>
  );
}

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14.5px] last:border-b-0">
    <span className={strong ? "font-medium text-ink" : "text-muted"}>{label}</span>
    <span className={clsx("text-right [font-variant-numeric:tabular-nums] text-ink", strong && "font-semibold")}>{value}</span>
  </div>
);

/** The three figures that sum a proposal up, wherever the template puts them. */
function Headline({ view }: { view: ProposalView }) {
  const figures: [string, string][] = [
    [`${view.system.kw} kW`, `${view.system.panels} panels${view.system.batteryKwh ? ` · ${view.system.batteryKwh} kWh battery` : ""}`],
    ...(view.bill && view.bill.saving > 0
      ? ([[`about ${dollars(view.bill.saving)}`, "estimated saving a year"]] as [string, string][])
      : []),
    [dollars(view.price.youPay), "you pay, after the federal rebate"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {figures.map(([figure, words]) => (
        <div key={words} className={clsx(card, "sm:p-5")}>
          <p className="text-[26px] leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">{figure}</p>
          <p className="mt-2 text-[13px] text-muted">{words}</p>
        </div>
      ))}
    </div>
  );
}

/** Going ahead, and a question: what a customer can do. In a preview both are shown and neither does anything. */
function GoAhead({ view, state, accepted, actions }: Pick<ProposalPageProps, "view" | "state" | "accepted" | "actions">) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ ok: boolean; text: string } | null>(null);
  const b = view.business;
  const line = acceptLine(view);

  if (state === "accepted")
    return (
      <div className={card}>
        <p className={eyebrow}>Accepted</p>
        <p className="mt-2 text-[18px] text-ink">
          {accepted ? `${accepted.name} accepted this proposal on ${day(accepted.at)}.` : "This proposal has been accepted."}
        </p>
        <p className="mt-2 text-sm text-muted">{b.name} will be in touch about what happens next.</p>
      </div>
    );
  if (state === "lapsed")
    return (
      <div className={card}>
        <p className={eyebrow}>Price lapsed</p>
        <p className="mt-2 text-[18px] text-ink">This price stood until {day(view.validUntil)}.</p>
        <p className="mt-2 text-sm text-muted">Ask {b.name} for an up-to-date proposal.</p>
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actions) return;
    setBusy(true);
    setProblem(await actions.accept(name, agree));
    setBusy(false);
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actions || !question.trim()) return;
    const failed = await actions.ask(question);
    setAsked(failed ? { ok: false, text: failed } : { ok: true, text: `Sent. ${b.name} will get back to you.` });
    if (!failed) setQuestion("");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={submit} className={card}>
        <h3 className="text-[18px] text-ink">Ready to go ahead?</h3>
        <p className="mt-1 text-sm text-muted">
          You pay {dollars(view.price.youPay)}. The price stands until {day(view.validUntil)}. Nothing is charged here.
        </p>
        <label className="mt-4 block text-[13px] font-medium text-ink">
          Your full name
          <input
            className={clsx(field, "mt-1.5")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-ink">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span>{line}</span>
        </label>
        {problem && (
          <p className="mt-3 text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className={clsx(button, "mt-4 w-full")} disabled={busy || !actions}>
          {busy ? "Sending…" : "I'd like to go ahead"}
        </button>
        {!actions && <p className={clsx(fine, "mt-2")}>A preview: your customer uses this from their own link.</p>}
      </form>
      <form onSubmit={send} className={card}>
        <h3 className="text-[18px] text-ink">A question first?</h3>
        <p className="mt-1 text-sm text-muted">
          Ask here{b.phone ? `, or call ${b.phone}` : ""}
          {b.email ? `${b.phone ? " or" : ", or"} email ${b.email}` : ""}.
        </p>
        <textarea
          className={clsx(field, "mt-4 min-h-28 py-2.5")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          aria-label="Your question"
        />
        {asked && (
          <p className={clsx("mt-3 text-[13px]", asked.ok ? "text-ink" : "text-danger")} role="status">
            {asked.text}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line bg-surface px-5 text-sm font-medium text-ink disabled:text-muted"
          disabled={!actions || !question.trim()}
        >
          Send my question
        </button>
      </form>
    </div>
  );
}

export interface ProposalPageProps {
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string } | null;
  urls: ProposalUrls;
  /** Left out in the business's own preview. */
  actions?: ProposalActions;
}

/**
 * A proposal as the customer reads it, under the business's own name, logo
 * and colours: never RENUABL's. One renderer for the customer's link and for
 * the business's preview, so what is previewed is what is sent.
 *
 * After the cover, the blocks come in the order the business has put them
 * in, each under its heading with the business's own words and picture
 * (`view.blocks`, from the customiser); the PDF follows the same list. The
 * three templates differ only in how the cover opens: Classic under a photo, Compact with the three figures
 * first, Bold on a full block of the business's colour. Colours come in as
 * the site's usual tokens (`themeVars`), so everything below uses tokens.
 * It is given the customer's copy only: there is no cost here to show.
 *
 * Figures are lined up with `[font-variant-numeric:tabular-nums]`, not the
 * `tabular-nums` class: inside the business's screens that class is set in
 * the design tool's monospace face, and the preview must look as the
 * customer's page does.
 */
export function ProposalPage({ view, state, accepted, urls, actions }: ProposalPageProps) {
  const b = view.business;
  const bold = view.template === "bold";
  const compact = view.template === "compact";
  const contact = [b.phone, b.email, b.website && shownWebsite(b.website)].filter(Boolean);
  const title = (
    <>
      <p className={clsx(eyebrow, bold && "text-[color:var(--primary-ink)] opacity-80")}>Proposal · {day(view.publishedAt)}</p>
      <h1
        className={clsx(
          "mt-3 text-[32px] leading-[1.1] tracking-tight [font-family:var(--proposal-heading)] sm:text-[44px]",
          bold ? "text-[color:var(--primary-ink)]" : "text-ink",
        )}
      >
        {view.title} for {view.customer.name}
      </h1>
      <p className={clsx("mt-3 text-[15px]", bold ? "text-[color:var(--primary-ink)] opacity-90" : "text-muted")}>
        {view.customer.address}
      </p>
    </>
  );

  // Each block's own content, by its id. Null when there is nothing to show for it on this proposal (no bill was
  // entered, no terms are set): the block is then left out, unless the business gave it words or a picture of its own.
  const terms = view.terms;
  const content: Record<BlockId, () => React.ReactNode> = {
    cover: () => null,
    system: () => (
      <div className={card}>
        {view.system.details.map((d) => (
          <Line key={d.label} label={d.label} value={d.value} />
        ))}
      </div>
    ),
    roof: () =>
      view.roof.panels.length > 0 ? (
        <>
          <Roof view={view} src={urls.roof} />
          <p className={clsx(fine, "mt-3")}>
            The {view.system.panels} panels as designed, seen from above. {ROOF_NOTE}
          </p>
        </>
      ) : null,
    production: () =>
      view.production ? (
        <div className={card}>
          <p className="text-[15px] text-ink">
            About{" "}
            <strong className="font-semibold [font-variant-numeric:tabular-nums]">
              {view.production.yearKwh.toLocaleString("en-AU")} kWh
            </strong>{" "}
            a year.
          </p>
          <div className="mt-5">
            <Months kwh={view.production.monthlyKwh} />
          </div>
          <p className={clsx(fine, "mt-4")}>{PRODUCTION_NOTE}</p>
        </div>
      ) : (
        <p className="text-[15px] text-muted">{NO_SUNSHINE_NOTE}</p>
      ),
    bill: () =>
      view.bill ? (
        <div className={card}>
          <Line label="A year's bill now (estimate)" value={dollars(view.bill.now)} />
          <Line label="A year's bill with this system (estimate)" value={dollars(view.bill.after)} />
          <Line label="Estimated saving a year" value={`about ${dollars(view.bill.saving)}`} strong />
          {view.paybackYears !== null && <Line label="Years for the saving to add up to the price" value={`about ${view.paybackYears}`} />}
          <p className={clsx(fine, "mt-4")}>
            {SAVING_NOTE} {ESTIMATE_NOTE}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-ink">What these figures assume</summary>
            <ul className={clsx(fine, "mt-2 list-disc space-y-1 pl-5")}>
              <li>
                A {view.bill.assumed.interval} bill of {dollars(view.bill.assumed.amount)}, which is about {view.bill.dailyKwh} kWh a day.
              </li>
              <li>
                ${view.bill.assumed.supplyPerDay.toFixed(2)} a day supply charge, ${view.bill.assumed.rate.toFixed(2)} a kWh, and $
                {view.bill.assumed.feedIn.toFixed(2)} a kWh for power sent to the grid.
              </li>
              <li>About {Math.round(view.bill.assumed.selfUseShare * 100)}% of the solar used in the home as it is made.</li>
              <li>The same use every day, one price all day, today&apos;s prices, and no shade.</li>
            </ul>
          </details>
        </div>
      ) : null,
    price: () => (
      <>
        <div className={card}>
          {/* The price as the business writes its prices: one figure with GST in it, or the two parts and the total. */}
          {view.price.gstShown === "excluded" && view.price.beforeGst !== undefined && view.price.gst !== undefined ? (
            <>
              <Line label="Price before GST" value={dollars(view.price.beforeGst)} />
              <Line label="GST" value={dollars(view.price.gst)} />
              <Line label="Price with GST" value={dollars(view.price.incGst)} />
            </>
          ) : (
            <Line label="Price, GST included" value={dollars(view.price.incGst)} />
          )}
          <Line label="Less the federal rebate (estimate)" value={`− ${dollars(view.price.stc)}`} />
          <div className="mt-3 flex items-baseline justify-between gap-4 rounded-lg bg-primary px-4 py-4 text-primary-ink">
            <span className="text-[15px] font-medium">You pay</span>
            <span className="text-[28px] leading-none tracking-tight [font-variant-numeric:tabular-nums]">
              {dollars(view.price.youPay)}
            </span>
          </div>
          {/* Solar Victoria, when it is on the quote: what it would come to if approved, never as the price itself. */}
          {view.price.solarVic && (
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                With Solar Victoria, if you are eligible and approved
              </p>
              <div className="mt-2">
                <Line label="Solar Victoria rebate" value={`− ${dollars(view.price.solarVic.rebate)}`} />
                <Line label="You would pay" value={dollars(view.price.solarVic.afterRebate)} />
                {view.price.solarVic.loan > 0 && (
                  <>
                    <Line label="Solar Victoria interest-free loan" value={`− ${dollars(view.price.solarVic.loan)}`} />
                    <Line label="To pay up front" value={dollars(view.price.solarVic.upfront)} />
                    <Line
                      label={`Then, for ${view.price.solarVic.loanMonths} months, with no interest`}
                      value={`$${view.price.solarVic.monthly.toFixed(2)} a month`}
                    />
                  </>
                )}
              </div>
              <p className={clsx(fine, "mt-3")}>{view.price.solarVic.note}</p>
            </div>
          )}
          <p className="mt-4 text-[14px] text-ink">Covers: {view.price.includes.join(", ")}.</p>
          <p className={clsx(fine, "mt-2")}>{STC_NOTE}</p>
        </div>
        {b.extra && <p className="mt-5 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{b.extra}</p>}
      </>
    ),
    // The business's own payment terms: what it asks up front, when the rest falls due, and where to pay.
    payment: () =>
      terms && (terms.deposit !== null || terms.milestones.length > 0 || terms.bank) ? (
        <div className={card}>
          {terms.deposit !== null && <Line label="Deposit to go ahead" value={dollars(terms.deposit)} strong />}
          {terms.milestones.map((m) => (
            <Line key={m.name} label={`${m.name} (${m.percent}%)`} value={dollars(m.amount)} />
          ))}
          {(terms.deposit !== null || terms.milestones.length > 0) && (
            <p className={clsx(fine, "mt-3")}>
              Worked out from what you pay, {dollars(view.price.youPay)}. Nothing is charged through this page.
            </p>
          )}
          {terms.bank && (
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">Pay by bank transfer to</p>
              <div className="mt-2">
                <Line label="Account name" value={terms.bank.name} />
                <Line label="BSB" value={shownBsb(terms.bank.bsb)} />
                <Line label="Account number" value={terms.bank.number} />
                {terms.bank.reference && <Line label="Reference" value={terms.bank.reference} />}
              </div>
              <p className={clsx(fine, "mt-3")}>{BANK_NOTE}</p>
            </div>
          )}
        </div>
      ) : null,
    timing: () =>
      terms?.installTime ? (
        <div className={card}>
          <Line label="Usual time from going ahead to installation" value={terms.installTime} strong />
          <p className={clsx(fine, "mt-3")}>{TIMING_NOTE}</p>
        </div>
      ) : null,
    // The business's own workmanship warranty, in its own words: its statement to its customer, and labelled as such.
    warranty: () =>
      terms?.warranty ? (
        <div className={card}>
          {terms.warranty.years !== null && (
            <Line
              label={`${b.name}'s workmanship warranty`}
              value={`${terms.warranty.years} ${terms.warranty.years === 1 ? "year" : "years"}`}
              strong
            />
          )}
          {terms.warranty.words && (
            <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{terms.warranty.words}</p>
          )}
          <p className={clsx(fine, "mt-3")}>{warrantyNote(b.name)}</p>
        </div>
      ) : null,
    about: () =>
      b.about || b.points.length > 0 || b.photos.length > 0 ? (
        <>
          {b.about && <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{b.about}</p>}
          {b.points.length > 0 && (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {b.points.map((point) => (
                <li key={point} className="rounded-lg border border-line bg-surface px-4 py-3 text-[14.5px] text-ink">
                  {point}
                </li>
              ))}
            </ul>
          )}
          {b.photos.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {b.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- as above
                <img
                  key={photo.id}
                  src={urls.image(photo.id)}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </>
      ) : null,
    "custom-1": () => null,
    "custom-2": () => null,
    "custom-3": () => null,
    accept: () => <GoAhead view={view} state={state} accepted={accepted} actions={actions} />,
    // The standard terms and conditions, when the business has them on: the details of this agreement (from the
    // proposal's own figures), the consumer information, then the terms as they stood when it was published. Closed
    // until asked for; the tick to go ahead refers to them.
    terms: () => {
      const contract = view.contract;
      if (!contract) return null;
      const details = contractDetails(view);
      return (
        <details className={card}>
          <summary className="cursor-pointer text-[15px] font-medium text-ink">Read the terms and conditions</summary>
          <h3 className="mt-5 text-[15px] font-semibold text-ink">Details</h3>
          <div className="mt-2">
            {details.rows.map((row) => (
              <Line key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
          <p className="mt-4 text-[13.5px] font-medium text-ink">The documents that make up this agreement, in the order they apply</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] text-ink">
            {details.documents.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ol>
          <h3 className="mt-6 text-[15px] font-semibold text-ink">{contract.netcc.heading}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{contract.netcc.intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink">
            {contract.netcc.guides.map((guide) => (
              <li key={guide}>{guide}</li>
            ))}
          </ul>
          <p className="mt-2 text-[13.5px] text-ink">
            The guides are at{" "}
            <a href={contract.netcc.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {contract.netcc.url.replace(/^https?:\/\//, "")}
            </a>
            . {contract.netcc.seller}
          </p>
          {contract.terms.map((part) => (
            <div key={part.heading} className="mt-5">
              <h3 className="text-[14.5px] font-semibold text-ink">{part.heading}</h3>
              {part.clauses.map((clause) => (
                <p key={clause} className="mt-2 text-[13.5px] leading-relaxed text-ink">
                  {clause}
                </p>
              ))}
            </div>
          ))}
          <p className={clsx(fine, "mt-5")}>Terms version {contract.version}.</p>
        </details>
      );
    },
    conditions: () => (b.conditions ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{b.conditions}</p> : null),
  };

  const blocks = viewBlocks(view);
  const cover = blocks.find((block) => block.id === "cover");
  /** A block's own words and picture, as the business set them in the customiser. */
  const own = (block: ViewBlock) => (
    <>
      {block.words && <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{block.words}</p>}
      {block.image && (
        // eslint-disable-next-line @next/next/no-img-element -- as above
        <img src={urls.image(block.image.id)} alt="" loading="lazy" className="mt-4 max-h-[26rem] w-full rounded-xl object-cover" />
      )}
    </>
  );

  return (
    <div style={themeVars(view.theme) as React.CSSProperties} className="min-h-dvh bg-canvas text-ink [color-scheme:light]">
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-5 sm:px-8">
        {b.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route at the size it was kept
          <img src={urls.image(b.logo.id)} alt={b.name} className="h-10 w-auto max-w-[200px] object-contain object-left" />
        ) : (
          <span className="text-[18px] font-semibold tracking-tight text-ink">{b.name}</span>
        )}
        <span className="text-[13px] text-muted">{contact.join(" · ")}</span>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-12 px-5 pb-20 sm:px-8">
        {/* How it opens: the one place the templates differ. Always first, whatever order the rest is in. */}
        <section aria-label="Proposal">
          {bold ? (
            <div className="rounded-2xl bg-primary px-6 py-12 sm:px-10 sm:py-16">{title}</div>
          ) : (
            <>
              {!compact && b.cover && (
                // eslint-disable-next-line @next/next/no-img-element -- as above
                <img src={urls.image(b.cover.id)} alt="" className="mb-8 aspect-[21/9] w-full rounded-2xl object-cover" />
              )}
              {title}
            </>
          )}
          {b.tagline && !bold && <p className="mt-2 text-[15px] text-ink">{b.tagline}</p>}
          {view.note && <p className="mt-6 max-w-2xl whitespace-pre-line text-[16px] leading-relaxed text-ink">{view.note}</p>}
          {cover && (cover.words || cover.image) && <div className="mt-6">{own(cover)}</div>}
          <div className="mt-8">
            <Headline view={view} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className={fine}>The price stands until {day(view.validUntil)}.</p>
            {urls.pdf && (
              <a
                href={urls.pdf}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink underline underline-offset-4"
              >
                <Download className="size-4" aria-hidden /> Download as a PDF
              </a>
            )}
          </div>
        </section>

        {/* The rest, in the business's own order: each block under its heading, with the business's own words and picture first. */}
        {blocks
          .filter((block) => block.id !== "cover")
          .map((block) => {
            const inner = content[block.id]();
            const hasOwn = Boolean(block.words || block.image);
            if (!inner && !hasOwn) return null;
            const heading = blockHeading(block, block.id === "about" ? `About ${b.name}` : "");
            return (
              <section key={block.id} aria-label={heading || undefined}>
                {heading && <h2 className={h2}>{heading}</h2>}
                {hasOwn && <div className={heading ? "mt-4" : undefined}>{own(block)}</div>}
                {inner && <div className={heading || hasOwn ? "mt-4" : undefined}>{inner}</div>}
              </section>
            );
          })}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-4xl space-y-1 px-5 py-6 text-[12.5px] text-muted sm:px-8">
          <p className="text-ink">{b.name}</p>
          {b.address && <p>{b.address}</p>}
          <p>{[b.abn && `ABN ${shownAbn(b.abn)}`, ...b.licences].filter(Boolean).join(" · ")}</p>
          <p>{contact.join(" · ")}</p>
        </div>
      </footer>
    </div>
  );
}

/** What a link shows once its proposal has been taken back: who to contact, and nothing of the proposal. */
export function ProposalGone({ business }: { business: Pick<ProposalView["business"], "name" | "phone" | "email" | "website"> }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-ink">
      <h1 className="text-[26px] leading-tight tracking-tight">This proposal isn&apos;t available any more.</h1>
      <p className="mt-3 text-[15px] text-muted">
        For an up-to-date one, get in touch with {business.name}
        {[business.phone, business.email].filter(Boolean).length
          ? `: ${[business.phone, business.email].filter(Boolean).join(" or ")}`
          : ""}
        .
      </p>
    </main>
  );
}
