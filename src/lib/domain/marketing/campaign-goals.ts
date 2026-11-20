/**
 * What a new campaign is for (20 Nov 2026, Martin: New campaign dived straight into a draft, "which takes me a little to
 * process im in draft and to orient myself"; the first screen should ask what he wants to achieve). Each goal says what
 * it is, what to tell Sol, and the angle Sol takes when he writes it. A goal never adds a fact: the brief is still the
 * only source of figures, offers and dates (edm-sol.ts).
 */

export const CAMPAIGN_GOALS = ["new", "offer", "news", "teach", "winback", "invite"] as const;
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const isCampaignGoal = (v: unknown): v is CampaignGoal => typeof v === "string" && (CAMPAIGN_GOALS as readonly string[]).includes(v);

export interface GoalWords {
  /** The tile. */
  label: string;
  /** One line under it. */
  what: string;
  /** What to tell Sol, as the brief box's own question. */
  ask: string;
  /** An example of an answer, shown in the empty box. */
  example: string;
  /** The campaign's name until Sol's subject, or the member, gives it one. */
  name: string;
  /** How Sol approaches this kind of email. Never a fact about the business. */
  angle: string;
}

export const GOAL_WORDS: Record<CampaignGoal, GoalWords> = {
  new: {
    label: "Announce something new",
    what: "A new product, service or feature.",
    ask: "What's new, and who is it for?",
    example: "We now install EV chargers. For past solar customers. I'd like them to reply for a quote.",
    name: "Announcement",
    angle: "This email announces something new. Lead with what it is and what it does for the reader, then the one next step.",
  },
  offer: {
    label: "Promote an offer",
    what: "A price, package or bonus with an end date.",
    ask: "What's the offer, who can have it, and when does it end?",
    example: "A free smart meter with any battery ordered before 19 December. For customers who already have solar.",
    name: "Offer",
    angle:
      "This email promotes an offer. State the offer, who it is for and its end date exactly as the brief gives them; if the brief gives no end date, give none.",
  },
  news: {
    label: "Share news or an update",
    what: "A rebate change, a price change, a new team member.",
    ask: "What has changed, and what does it mean for them?",
    example: "The battery rebate steps down on 1 January. Customers thinking about a battery should talk to us this month.",
    name: "Update",
    angle: "This email shares news. Say what has changed straight away, then what it means for the reader.",
  },
  teach: {
    label: "Teach something useful",
    what: "Tips or a short guide, nothing to sell.",
    ask: "What should they come away knowing?",
    example: "Three ways to get more from a battery in winter: run the dishwasher at midday, check the app weekly, clean the panels.",
    name: "Tips",
    angle:
      "This email teaches something useful. Be practical and specific, a short list if it helps, and sell nothing beyond a soft next step.",
  },
  winback: {
    label: "Win back quiet contacts",
    what: "People who enquired or were quoted and went quiet.",
    ask: "Who are they, and what would bring them back?",
    example: "People we quoted this year who didn't go ahead. Prices on our panels have come down, and we can update their quote in a day.",
    name: "Checking in",
    angle:
      "This email checks in with people who went quiet. Short and personal, no guilt and no pressure: one reason to look again and one easy way to reply.",
  },
  invite: {
    label: "Invite them to something",
    what: "An open day, a webinar, a demo or a call.",
    ask: "What is it, when and where, and how do they book?",
    example: "A 30-minute online demo on Thursday 4 December at 4 pm. They book by replying to this email.",
    name: "Invitation",
    angle: "This email is an invitation. Give what it is, when and where, and how to say yes, each exactly as the brief gives it.",
  },
};

/** The line Sol is given for a goal, after his rules. */
export const goalAngle = (goal: CampaignGoal | null | undefined): string | null => (goal ? GOAL_WORDS[goal].angle : null);

/** A campaign's name from what Sol wrote, else the goal's own word. */
export function campaignName(goal: CampaignGoal | null, subject?: string): string {
  const s = (subject ?? "")
    .replace(/\{[A-Za-z_]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (s || (goal ? GOAL_WORDS[goal].name : "New campaign")).slice(0, 80);
}
