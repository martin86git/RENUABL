"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { themeVars } from "@/lib/domain/design/brand";
import {
  INDICATIVE_PRICE_NOTE,
  STC_NOTE,
  acceptLine,
  contractDetails,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import { openProposal, orderFromConfigurator, proposalUrls, sayPaid, type OpenedProposal } from "@/lib/services/proposals";
import { PayDeposit } from "./deposit-panel";
import { PaySchedule } from "./pay-schedule";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const cents = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The order page (19 Nov 2026, Martin: Order "takes them to a more simplified proposal page that contains only what
 * we must contain by law… this page should be boring, so that the consumer is incentivised not to dwell on it, as the
 * experience comes from the configurator"). Plain on purpose: what they are ordering, the price and how it is paid,
 * the details of the agreement, the consumer information and the terms in full, then the order. Every word of it is
 * still there; nothing is decorated. On a final proposal the order is going ahead (name and tick, as the proposal
 * page); on an indicative one it asks for the system and week, confirmed after the site visit.
 */
export function OrderPage(props: {
  token: string;
  /** The proposal as the mix ordered (`viewForChoice`). */
  view: ProposalView;
  state: ProposalState;
  mix: string;
  /** The mix in a few words. */
  what: string;
  week: { monday: string; label: string } | null;
  backHref: string;
}) {
  const { token, view } = props;
  const urls = useMemo(() => proposalUrls(token), [token]);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<"ordered" | "requested" | null>(props.state === "accepted" ? "ordered" : null);
  // Once ordered, the deposit due today and how to pay it (19 Nov 2026, Martin: Due today, then Order), read from the
  // proposal's own link as its page reads it: by card through the business's Stripe, or by bank transfer.
  const [paying, setPaying] = useState<OpenedProposal | null>(null);
  useEffect(() => {
    if (done !== "ordered") return;
    let gone = false;
    void openProposal(token).then((res) => !gone && res.ok && setPaying(res));
    return () => {
      gone = true;
    };
  }, [done, token]);
  const details = contractDetails(view);
  const indicative = Boolean(view.indicative);

  const order = async () => {
    setBusy(true);
    setProblem(null);
    const res = await orderFromConfigurator(token, {
      option: props.mix,
      week: props.week?.monday ?? "",
      ...(indicative ? {} : { name, agree }),
    });
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setDone(res.kind);
  };

  return (
    <div style={themeVars(view.theme) as React.CSSProperties} className="min-h-dvh bg-canvas text-ink [color-scheme:light]">
      <main className="mx-auto w-full max-w-2xl px-5 py-10 text-[14px] leading-relaxed sm:px-8">
        <p className="text-[13px] text-muted">{view.business.name}</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{indicative ? "Your order request" : "Your order"}</h1>
        <p className="mt-1 text-muted">
          For {view.customer.name}, {view.customer.address}
        </p>
        <Link href={props.backHref} className="mt-3 inline-block text-[13px] underline underline-offset-4">
          Back to your system
        </Link>

        <Part title="What you are ordering">
          <p>{props.what}.</p>
          <Table rows={view.system.details.map((d) => ({ label: d.label, value: d.value }))} />
          <p className="mt-3">
            Installation: {props.week ? `${props.week.label}, the day confirmed with you` : "the week is arranged with you"}.
            {indicative ? " Confirmed after we visit your home." : " Subject to approvals."}
          </p>
        </Part>

        <Part title="The price">
          <Table
            rows={[
              { label: "System, installed (GST included)", value: dollars(view.price.incGst) },
              { label: "Federal rebate (STCs), an estimate until installation", value: `− ${dollars(view.price.stc)}` },
              { label: "You pay", value: dollars(view.price.youPay) },
              ...(view.terms?.deposit ? [{ label: "Deposit", value: cents(view.terms.deposit) }] : []),
              ...(view.terms?.milestones ?? []).map((m) => ({
                label: `${m.name} (${Math.round(m.percent * 100)}%)`,
                value: cents(m.amount),
              })),
            ]}
          />
          {view.price.solarVic && <p className="mt-3 text-muted">{view.price.solarVic.note}</p>}
          <p className="mt-3 text-muted">
            {indicative ? `${INDICATIVE_PRICE_NOTE} ` : ""}
            {STC_NOTE}
          </p>
          {view.variations?.length ? (
            <p className="mt-3 text-muted">
              May also apply, found at the site inspection and agreed with you first: {view.variations.join("; ")}.
            </p>
          ) : null}
        </Part>

        {!indicative && (
          <Part title="The agreement">
            <Table rows={details.rows} />
          </Part>
        )}

        {view.contract && (
          <Part title="Your rights as a consumer">
            <p className="font-medium">{view.contract.netcc.heading}</p>
            <p className="mt-1">{view.contract.netcc.intro}</p>
            <p className="mt-2">
              Free guides: {view.contract.netcc.guides.join(", ")}, at{" "}
              <a href={view.contract.netcc.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {view.contract.netcc.url.replace(/^https?:\/\//, "")}
              </a>
              .
            </p>
            <p className="mt-2">{view.contract.netcc.seller}</p>
          </Part>
        )}

        {!indicative && (
          <Part title="Terms and conditions">
            {view.ownTerms ? (
              <p>
                {view.business.name}&apos;s terms and conditions go with this order:{" "}
                <a href={urls.terms} className="underline underline-offset-2">
                  {view.ownTerms.name} (PDF)
                </a>
                .
              </p>
            ) : view.contract ? (
              <div className="max-h-96 overflow-y-auto rounded-md border border-line bg-surface p-4 text-[12.5px]">
                {view.contract.terms.map((section) => (
                  <div key={section.heading} className="mb-3">
                    <p className="font-medium">{section.heading}</p>
                    {section.clauses.map((clause, i) => (
                      <p key={i} className="mt-1">
                        {clause}
                      </p>
                    ))}
                  </div>
                ))}
                <p className="text-muted">Terms version {view.contract.version}.</p>
              </div>
            ) : (
              <p>{view.business.name} has set no standard terms for this proposal. Its conditions, if any, are shown above.</p>
            )}
            {view.business.conditions && <p className="mt-3 whitespace-pre-line">Special conditions: {view.business.conditions}</p>}
          </Part>
        )}

        <Part title={indicative ? "Place your order request" : "Place your order"}>
          {done ? (
            <div>
              <p className="font-medium">{done === "ordered" ? "Your order is placed." : "Your order request is in."}</p>
              <p className="mt-1">
                {done === "ordered"
                  ? `${view.business.name} has your order and will confirm your installation day with you.`
                  : `${view.business.name} will be in touch to book a visit to your home, then send your final proposal to confirm.`}
              </p>
              {done === "ordered" && paying?.view && (paying.payments || paying.deposit) && (
                <div className="mt-5 space-y-4">
                  {paying.payments && <PaySchedule token={token} business={view.business.name} payments={paying.payments} />}
                  {paying.deposit && (
                    <PayDeposit
                      view={paying.view}
                      deposit={paying.deposit}
                      cardsHere={Boolean(paying.payments?.cards)}
                      onPaid={async (way) => {
                        const res = await sayPaid(token, way);
                        if (!res.ok) return res.message;
                        setPaying(res);
                        return null;
                      }}
                    />
                  )}
                </div>
              )}
              {done === "ordered" && (
                <Link href={`/p/${encodeURIComponent(token)}`} className="mt-3 inline-block underline underline-offset-4">
                  Your full proposal
                </Link>
              )}
            </div>
          ) : props.state !== "live" ? (
            <p>
              {props.state === "lapsed"
                ? "This price has lapsed: ask for an up-to-date proposal."
                : "This proposal isn't available any more."}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void order();
              }}
            >
              {indicative ? (
                <p>
                  Nothing is charged and nothing is agreed: this asks {view.business.name} to visit, confirm the design and send your final
                  proposal.
                </p>
              ) : (
                <>
                  <label className="block">
                    Your full name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className="mt-1 block h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px]"
                    />
                  </label>
                  <label className="mt-3 flex items-start gap-2">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4" />
                    <span>{acceptLine(view)}</span>
                  </label>
                </>
              )}
              {problem && <p className="mt-3 text-danger">{problem}</p>}
              <button
                type="submit"
                disabled={busy || (!indicative && (!name.trim() || !agree))}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-[15px] font-medium text-[color:var(--primary-ink)] disabled:bg-line-strong disabled:text-muted"
              >
                {busy ? "Placing it…" : indicative ? "Place order request" : `Place order · ${dollars(view.price.youPay)}`}
              </button>
            </form>
          )}
        </Part>
      </main>
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="mt-2 divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4 py-1.5">
          <dt className="text-muted">{r.label}</dt>
          <dd className="text-right [font-variant-numeric:tabular-nums]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
