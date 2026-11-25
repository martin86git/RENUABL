/**
 * The tour of a deal (20 Nov 2026, Martin: a new business gets one sample deal, "that when clicked on starts a tour of
 * how to navigate a deal card. explains all the featuers on it"). Each place on the deal's page, in order, lit by the
 * spotlight (new-look.tsx `Spotlight`); a place not on screen is passed over. It runs when the sample deal is opened
 * from the pipeline, the first time it is opened any other way on a device, and from Show me around on its page.
 */
export const DEAL_TOUR: readonly { what: string; now: string; at: string }[] = [
  {
    what: "This is a sample deal,",
    now: "made up so you can look around. The banner is the deal at a glance: who it's for, where it's at, the price, and the system and roof once it's designed.",
    at: '[data-tour="deal-banner"]',
  },
  {
    what: "Sol",
    now: "reads every deal and says what happened, what he'll do next and what needs you. Type in his box to have him write to the customer or start the design.",
    at: '[data-tour="deal-sol"]',
  },
  {
    what: "Design",
    now: "opens the designer on this deal's roof. Lay the panels and the quote builds as you go. A deal needs its address on the map first.",
    at: '[data-tour="deal-design"]',
  },
  {
    what: "Proposal",
    now: "is what the customer sees. Check it, send it, and they read it, ask questions and sign on a page of their own.",
    at: '[data-tour="deal-proposal"]',
  },
  {
    what: "Call, Email and Files",
    now: "are how you reach the customer. Ring them yourself or take notes as you talk, email them from the deal, and keep their bills and photos with it.",
    at: '[data-tour="deal-reach"]',
  },
  {
    what: "Details",
    now: "is the deal's own record. A deal opens on its timeline: every email, note, call, design and proposal, newest first.",
    at: '[data-tour="deal-details"]',
  },
  {
    what: "Inside Details",
    now: "are four views: the Timeline (everything that has happened, newest first), the deal's fields, your chat with the customer, and your team's chat about the deal.",
    at: '[data-tour="deal-views"]',
  },
  {
    what: "Every field",
    now: "is changed where it is: click, type, and it's saved. Changing the stage moves the deal along your pipeline.",
    at: '[data-tour="deal-fields"]',
  },
  {
    what: "This menu grows with the deal.",
    now: "A job card for your installers appears once it's sold, and Service once it's installed. The last round asks Sol about this deal alone.",
    at: 'nav[aria-label="This deal"]',
  },
  {
    what: "Deals",
    now: "takes you back to your pipeline. This sample is yours to try things on. Delete it when you're done, and add your first real deal with New deal.",
    at: '[data-tour="deal-back"]',
  },
];

/** Kept on the device once the tour has been seen, so the sample deal opened again doesn't start it by itself. */
export const DEAL_TOUR_KEY = "renuabl.design.deal-tour";

/** The words on the sample deal's card in the pipeline. */
export const SAMPLE_DEAL_HINT = "Sample deal · open it for a tour";
