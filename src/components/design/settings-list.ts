/**
 * Everything under Settings, in the order of its own nav: the second column
 * beside the product's sections. `soon` marks a page that is named and has
 * its place, and says plainly that it isn't built yet.
 */
export const SETTINGS: { title: string; items: { slug: string; label: string; soon?: string }[] }[] = [
  {
    title: "Pricing",
    items: [
      { slug: "price-lists", label: "Price lists" },
      { slug: "parts", label: "Parts on every job" },
      { slug: "installation-rates", label: "Installation rates" },
      { slug: "commission", label: "Sales commission" },
      { slug: "margin", label: "Margin and fixed costs" },
    ],
  },
  {
    title: "Proposal defaults",
    items: [
      { slug: "electricity", label: "Electricity rates" },
      { slug: "company", label: "Company details" },
      { slug: "theme", label: "Logo, theme, colours and fonts" },
      { slug: "wording", label: "About you and wording" },
      { slug: "customiser", label: "Proposal customiser" },
      { slug: "payment", label: "Payment terms and bank details" },
      { slug: "warranty", label: "Workmanship warranty" },
      { slug: "conditions", label: "Special conditions" },
      { slug: "terms", label: "Terms and conditions" },
      { slug: "installation-time", label: "Installation time" },
      { slug: "signed-emails", label: "Emails for proposals and chat" },
    ],
  },
  {
    title: "After the sale",
    items: [
      { slug: "suppliers", label: "Suppliers and ordering" },
      { slug: "installer-invoices", label: "Installer invoices" },
      { slug: "automations", label: "Customer reminders" },
    ],
  },
  {
    title: "Business",
    items: [
      { slug: "users", label: "Users and permissions" },
      { slug: "billing", label: "Billing" },
    ],
  },
];

export const SETTINGS_HOME = "/design/settings";
export const settingsPath = (slug: string) => `${SETTINGS_HOME}/${slug}`;
export const settingBySlug = (slug: string) => SETTINGS.flatMap((g) => g.items).find((i) => i.slug === slug) ?? null;
