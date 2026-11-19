import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { OrderPage } from "@/components/design/order-page";
import { ProposalGone } from "@/components/design/proposal-view";
import { isConfigKey, mixWords, readConfigurator, variantOf } from "@/lib/domain/design/configurator";
import { viewForChoice } from "@/lib/domain/design/proposal";
import { todayInMarket } from "@/lib/domain/market";
import { installWeeksFor } from "@/lib/server/design-configurator";
import { proposalJob, publicProposal } from "@/lib/server/design-proposal-repo";

export const metadata: Metadata = {
  title: { absolute: "Your order" },
  description: "Your order.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: "Your order", description: "Your order.", locale: "en_AU" },
  twitter: { card: "summary", title: "Your order", description: "Your order." },
};

const one = (raw: string | string[] | undefined) => (typeof raw === "string" ? raw.slice(0, 40) : null);

/**
 * The order page behind the configurator's Order (19 Nov 2026, Martin): the mix in `?mix=` (one the proposal was
 * published with, else the business's recommendation) and the week in `?week=` (one the calendar offers now). Once
 * ordered, the mix ordered.
 */
export default async function OrderProposalPage({ params, searchParams }: PageProps<"/p/[token]/order">) {
  await connection();
  const { token } = await params;
  const query = await searchParams;
  const found = await publicProposal(token, todayInMarket()).catch(() => null);
  if (!found) notFound();
  if (!found.view) return <ProposalGone business={found.business} />;
  if (!found.view.configurator) redirect(`/p/${encodeURIComponent(token)}`);
  const cfg = readConfigurator(found.view.configurator);
  const asked = isConfigKey(found.accepted?.option) ? found.accepted?.option : one(query.mix);
  const mix = variantOf(cfg, asked) ?? variantOf(cfg, cfg.start);
  if (!mix) redirect(`/p/${encodeURIComponent(token)}/configure`);
  const job = await proposalJob(token).catch(() => null);
  const weeks = job ? await installWeeksFor(job.businessId).catch(() => []) : [];
  const week = weeks.find((w) => w.monday === one(query.week)) ?? null;
  const back = `/p/${encodeURIComponent(token)}/configure?mix=${encodeURIComponent(mix.goal)}${week ? `&week=${week.monday}` : ""}`;
  return (
    <OrderPage
      token={token}
      view={viewForChoice({ ...found.view, configurator: cfg }, mix.goal)}
      state={found.state}
      mix={mix.goal}
      what={mixWords(cfg, mix.goal) ?? found.view.title}
      week={week}
      backHref={back}
    />
  );
}
