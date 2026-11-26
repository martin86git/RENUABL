/**
 * "Nobody got into solar to do paperwork." (26 Nov 2026, Martin): a launch email of its own that introduces Sol by the
 * admin he takes, kept as one more draft campaign beside the launch and its series (gtm-drafts.ts), laid out as they
 * are: the bar for whoever is ready to buy, one warm panel (the hook, its picture, the words, a button), then the
 * $2-a-day strip and the Marketplace band. The words are Martin's; one line was changed with the picture ("Your people
 * sell. Sol takes the rest." read as if Sol didn't sell: "but sol is also selling through voice ai and writing emails").
 *
 * Its picture (marketing/launch/paperwork.gif, drawn by tools/marketing/launch-art.mjs): the calls, emails and admin as
 * sheets of paper swept into Sol's own sun from the homepage. Added by the same route as the other drafts
 * (/api/design/marketing/gtm), once by name; never sent or scheduled by adding it.
 */
import type { EdmBlock, EdmContent } from "./edm";
import { GTM_PICTURES, PANEL_FIRST, TOP_BAR, type GtmPicture } from "./gtm-drafts";

const SITE = "https://www.renuabl.com.au/";
const PRICING = `${SITE}#pricing`;
const MARKETPLACE = `${SITE}design/marketplace`;

export const GTM_SOL_CAMPAIGN_NAME = "Nobody got into solar · meet Sol";

/** The line the picture carries, said in the email's words too. */
export const GTM_SOL_LINE = "You do the solar. Sol calls, writes and chases.";

export const GTM_SOL_PICTURES: Record<string, GtmPicture> = {
  paperwork: {
    file: "paperwork.gif",
    alt: `Lead calls, follow-up emails, quote chasing, call notes, network rules and reminders, swept into Sol. ${GTM_SOL_LINE}`,
  },
};

/** The pictures this email needs made: its own, and the two bands every launch email ends on. */
export const GTM_SOL_NEEDS: Record<string, GtmPicture> = {
  ...GTM_SOL_PICTURES,
  footv: GTM_PICTURES.footv,
  footer: GTM_PICTURES.footer,
};

const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtms${id}`, imageId: null, ...b });
const picture = (key: string, url: string) => block(`pic${key}`, { kind: "image", text: GTM_SOL_NEEDS[key].alt, url, align: "center" });

export const GTM_SOL: EdmContent = {
  subject: "Nobody got into solar to do paperwork.",
  preview: "Meet Sol. He does the admin.",
  blocks: [
    block("bar", { kind: "bar", text: TOP_BAR[0], label: TOP_BAR[1], url: PRICING, align: "left" }),
    block("h", { kind: "heading", text: "Nobody got into solar to do paperwork.", url: null, align: "center", fill: PANEL_FIRST }),
    { ...picture("paperwork", SITE), fill: PANEL_FIRST },
    block("t", {
      kind: "text",
      text: [
        "{firstName},",
        "Follow-up emails. Quote chasing. Network rules. Notes nobody wrote down.",
        "That's not solar. That's admin, and it eats your week.",
        "Meet Sol, the AI built into RENUABL by people who know solar. Sol drafts your customer emails, checks the deal, answers the network and standards questions, and keeps your reminders. Our voice agents call the leads and the quiet quotes, then hand the warm ones back to your team.",
        GTM_SOL_LINE,
        "Real AI. Built by solar.",
      ].join("\n\n"),
      url: null,
      align: "left",
      fill: PANEL_FIRST,
    }),
    block("b", { kind: "button", text: "Meet Sol", url: SITE, align: "center", fill: PANEL_FIRST }),
    picture("footv", SITE),
    picture("footer", MARKETPLACE),
  ],
};
