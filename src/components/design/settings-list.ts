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
      { slug: "theme", label: "Logo, theme and colours" },
      {
        slug: "customiser",
        label: "Proposal customiser",
        soon: "Choose which blocks a proposal has, put them in your own order, and give each its own words and pictures.",
      },
      {
        slug: "payment",
        label: "Payment terms and bank details",
        soon: "GST shown included or excluded, the deposit (none, a percentage or a fixed amount), payment milestones, and the bank details a customer pays into.",
      },
      {
        slug: "warranty",
        label: "Workmanship warranty",
        soon: "How many years you warrant your workmanship for, and your warranty wording at the end of each proposal.",
      },
      { slug: "conditions", label: "Special conditions" },
      {
        slug: "installation-time",
        label: "Installation time",
        soon: "How long from acceptance to installation, as every proposal says it.",
      },
      {
        slug: "signed-emails",
        label: "Signed proposal emails",
        soon: "Who else is emailed a copy when a customer accepts a proposal. Sending email for a business isn't set up yet.",
      },
    ],
  },
  {
    title: "Business",
    items: [
      { slug: "users", label: "Users and permissions" },
      {
        slug: "billing",
        label: "Billing",
        soon: "Your RENUABL plan, invoices and payment method. There is no charge while the product is in development.",
      },
    ],
  },
];

export const SETTINGS_HOME = "/design/settings";
export const settingsPath = (slug: string) => `${SETTINGS_HOME}/${slug}`;
export const settingBySlug = (slug: string) => SETTINGS.flatMap((g) => g.items).find((i) => i.slug === slug) ?? null;
