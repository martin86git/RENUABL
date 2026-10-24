import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignAccountPage } from "@/components/design/design-account";
import { BrandSettings } from "@/components/design/design-proposal";
import { AfterSaleSettings, type AfterSalePart } from "@/components/design/settings-after-sale";
import { DesignSettings, type PricePart } from "@/components/design/design-settings";
import { DesignShell } from "@/components/design/design-shell";
import { DealFieldsSettings } from "@/components/design/settings-deal-fields";
import { DatasheetSettings } from "@/components/design/settings-datasheets";
import { TargetsSettings } from "@/components/design/settings-targets";
import { settingBySlug } from "@/components/design/settings-list";
import { SettingSoon, SettingsFrame } from "@/components/design/settings-nav";
import { BillingPage, NeedsCosts, ProposalSettings, type ProposalPart } from "@/components/design/settings-proposal";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

const PRICES: Record<string, PricePart> = {
  "price-lists": "lists",
  parts: "parts",
  "installation-rates": "install",
  commission: "commission",
  margin: "margin",
  electricity: "electricity",
};
const BRAND: Record<string, "who" | "look" | "words"> = { company: "who", theme: "look", wording: "words" };
const PROPOSAL: Record<string, ProposalPart> = {
  payment: "payment",
  warranty: "warranty",
  "installation-time": "time",
  conditions: "conditions",
  terms: "terms",
  "signed-emails": "emails",
  customiser: "customiser",
};

const AFTER_SALE: Record<string, AfterSalePart> = { suppliers: "suppliers", "installer-invoices": "invoices", automations: "automations" };

/** One page of a business's settings, beside the settings' own nav. */
export default async function DesignSettingPage({ params }: PageProps<"/design/settings/[section]">) {
  const { section } = await params;
  const setting = settingBySlug(section);
  if (!setting) notFound();
  // The prices work on the device without an account (so the designer can be tried first); the rest needs a business.
  const needsAccount = !(section in PRICES);
  return (
    <DesignShell needsAccount={needsAccount}>
      <SettingsFrame>
        {setting.soon ? (
          <SettingSoon label={setting.label} soon={setting.soon} />
        ) : section in PRICES ? (
          // The server sends no costs to someone who may not see them: they get a plain note in place of the page.
          <NeedsCosts>
            <DesignSettings part={PRICES[section]} />
          </NeedsCosts>
        ) : section in BRAND ? (
          <BrandSettings part={BRAND[section]} />
        ) : section in PROPOSAL ? (
          <ProposalSettings part={PROPOSAL[section]} />
        ) : section in AFTER_SALE ? (
          <AfterSaleSettings part={AFTER_SALE[section]} />
        ) : section === "targets" ? (
          <TargetsSettings />
        ) : section === "datasheets" ? (
          <DatasheetSettings />
        ) : section === "deal-fields" ? (
          <DealFieldsSettings />
        ) : section === "billing" ? (
          <BillingPage />
        ) : (
          <DesignAccountPage />
        )}
      </SettingsFrame>
    </DesignShell>
  );
}
