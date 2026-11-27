/**
 * Email one, "A new era" (27 Nov 2026, Martin: "the very first marketing email to awaken the database to RENUABL. It
 * should feel like something huge has landed. Sol should feel like unbelievable supercharged intelligence, the oracle
 * of solar. It should feel like 'its finally arrived' and we welcome in the dawn of a new era. AI built to save solar
 * from its admin drudgery. The images need to be influenced by grok bot, spacex, tesla, apple").
 *
 * One more draft campaign beside the launch, its series and Meet Sol (gtm-drafts.ts, gtm-sol-draft.ts), added by the
 * same route (/api/design/marketing/gtm), once by name; never sent or scheduled by adding it. Three pictures drawn by
 * tools/marketing/launch-art.mjs into marketing/launch/ carry it (the sunrise, Sol as the oracle, the admin handed over), with few words
 * between them (Martin, 22 Nov: "far too much text"). Every claim is something the product does today; "oracle" and
 * "new era" are the mood, never a measure: no best, first, leading or guaranteed, and Sol drafts while a person sends.
 */
import { firstMonthWords } from "@/lib/domain/design/plans";
import type { EdmBlock, EdmContent } from "./edm";
import { GTM_PICTURES, type GtmPicture } from "./gtm-drafts";

const SITE = "https://www.renuabl.com.au/";
const MARKETPLACE = `${SITE}design/marketplace`;

export const GTM_ERA_CAMPAIGN_NAME = "Email one · A new era";

/** The most words the email's own text may run to. */
export const GTM_ERA_MAX_WORDS = 70;

/** The line each picture carries (a test keeps the picture tool saying the same). */
export const GTM_ERA_LINES = {
  dawn: ["The dawn of", "A new era", "for solar."],
  oracle: ["The oracle", "of solar."],
  admin: ["The admin era", "is over."],
};

/** What Sol is asked in the oracle picture, and where each answer comes from. */
export const GTM_ERA_ASKS: [string, string][] = [
  ["What's the export limit on this network?", "Answered, with its sources."],
  ["What's this inverter's max input voltage?", "Answered from its datasheet."],
  ["Who should I call first this morning?", "Answered from your own deals."],
];

/** The admin handed over in the third picture: the job, and what happens to it now. */
export const GTM_ERA_ADMIN: [string, string][] = [
  ["Follow-up emails", "Drafted by Sol."],
  ["Call notes", "Written up by Sol."],
  ["New leads", "Answered in minutes."],
  ["Quotes", "Priced as you draw."],
  ["After-sale paperwork", "Lined up when they sign."],
];

export const GTM_ERA_PICTURES: Record<string, GtmPicture> = {
  eradawn: {
    file: "era-dawn.gif",
    alt: "Sol rises over the horizon. The dawn of a new era for solar.",
  },
  eraoracle: {
    file: "era-oracle.gif",
    alt: "The oracle of solar. Ask Sol about networks, rebates, standards, datasheets, your deals and your calls, and he says where each answer came from.",
  },
  eraadmin: {
    file: "era-admin.gif",
    alt: `${GTM_ERA_ADMIN.map(([job]) => job).join(", ")}: handed to Sol. The admin era is over.`,
  },
};

/** The pictures this email needs made: its own, and the two bands every launch email ends on. */
export const GTM_ERA_NEEDS: Record<string, GtmPicture> = {
  ...GTM_ERA_PICTURES,
  footv: GTM_PICTURES.footv,
  footer: GTM_PICTURES.footer,
};

const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtme${id}`, imageId: null, ...b });
const picture = (key: string, url: string) => block(`pic${key}`, { kind: "image", text: GTM_ERA_NEEDS[key].alt, url, align: "center" });

export const GTM_ERA: EdmContent = {
  subject: "It's finally here.",
  preview: "The dawn of a new era for solar. Meet Sol.",
  blocks: [
    block("h", { kind: "heading", text: "It's finally here.", url: null, align: "left" }),
    picture("eradawn", SITE),
    block("t", {
      kind: "text",
      text: [
        "{firstName}, solar has waited a long time for this.",
        "Meet Sol. AI built for solar, and built to end its admin drudgery.",
        "Ask him anything. Then watch him take the work.",
      ].join("\n\n"),
      url: null,
      align: "left",
    }),
    picture("eraoracle", SITE),
    picture("eraadmin", SITE),
    block("u", {
      kind: "text",
      text: [
        "He drafts. You decide. Nothing reaches a customer without you.",
        `This is day one. Your first month is ${firstMonthWords}.`,
      ].join("\n\n"),
      url: null,
      align: "left",
    }),
    block("b", { kind: "button", text: "Step into the new era", url: SITE, align: "left" }),
    picture("footv", SITE),
    picture("footer", MARKETPLACE),
  ],
};
