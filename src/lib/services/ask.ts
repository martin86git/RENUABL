/**
 * "Ask Revo" answers. Claude answers on the server (/api/ask), grounded in
 * reviewed facts and the customer's answers; without it, a small intent
 * matcher over canned, reviewed answers.
 */
import type { AskContext, AskSnapshot } from "@/lib/domain/ask-knowledge";

export type { AskContext, AskSnapshot } from "@/lib/domain/ask-knowledge";
export { REVO_GREETINGS } from "@/lib/domain/ask-knowledge";

export interface AskAnswer {
  answer: string;
  followUps: string[];
}

const INTENTS: { match: RegExp; answer: string }[] = [
  {
    match: /flat|tilt/i,
    answer:
      'Flat roofs are fine. Choose "Flat" for your roof, then how you\'d like your panels: laid flat (low profile, and we size your system to make up for the slightly lower output) or tilted towards the sun (more power, at extra cost). Tilting needs room for all your panels and can be seen from the street, so we check both on your 15-minute call.',
  },
  {
    match: /battery|batteries|storage|night|evening/i,
    answer:
      "A battery stores the solar you don't use during the day so your home can run on it at night. We only recommend one when it pays for itself for your household. You can remove it on your recommendation screen at any time.",
  },
  {
    match: /(no|don'?t have|haven'?t got|without|lost|can'?t find|skip).{0,20}bill|bill.{0,20}(skip|without)/i,
    answer:
      "We need your latest electricity bill to size your system, so it can't be skipped. The quickest way is to download it (PDF) from your energy retailer's app, website or email, or take a photo of the paper bill. A screenshot works too. Your answers are kept while you get it. Can't get it now? Leave your email in the box under the upload and we'll get in touch.",
  },
  {
    match: /heat pump|hot water|reverse.?cycle|air ?con|upgrade|switchboard|smart home/i,
    answer:
      "Upgrades are worth it when they move energy use into the daytime, when your solar is free. Smart switchboards aren't priced online yet: tick them and we'll quote them on your 15-minute call. Blackout Backup (backup circuits for your battery) can be added with a battery. Heat pump hot water and reverse-cycle heating and cooling are coming soon: tick them and we'll let you know when they're available.",
  },
  {
    match: /bill|upload|usage|pool|spa|heating|cooling/i,
    answer:
      "Your bill shows how much power your home really uses, and when. We size your solar to cover that and your battery to cover your evenings, nothing bigger than you need. We only read the usage and prices; your bill isn't stored.",
  },
  {
    match: /cost|price|expensive|afford|finance|pay/i,
    answer:
      "Your price already includes government rebates we apply for you. There's nothing to pay to reserve your date. After your 15-minute confirmation call, a $499 refundable deposit locks it in, and the balance is due once your system is installed and switched on.",
  },
  {
    match: /refund|cancel|deposit/i,
    answer:
      "Reserving your date is free. The $499 deposit is only asked for after your confirmation call, and it's fully refundable until your installation partner confirms the site visit. If anything doesn't feel right, we'll refund it, no questions asked.",
  },
  {
    match: /install|how long|day|takes/i,
    answer: "Most homes are done in a single day. You choose the day, and your installation partner arrives between 7am and 9am.",
  },
  {
    match: /installer|who|trust|licen[cs]ed|accredit/i,
    answer:
      "Every RENUABL installation partner is licensed and accredited. We match you with the best fit for your area and your system, and you can see the alternatives if you'd prefer someone else.",
  },
  {
    match: /call|confirm|phone|15/i,
    answer:
      "The 15-minute call is a quick check of the details — roof, switchboard and access — so install day goes smoothly. It isn't a sales call.",
  },
  {
    match: /roof|shade|tile|panel|space/i,
    answer:
      "We size your system from your bill, so it matches what your home uses, and check your roof, switchboard and access on the 15-minute confirmation call. If something needs adjusting, we'll update your recommendation before anything is final.",
  },
  {
    match: /sav(e|ing)|bill|money|payback/i,
    answer:
      "Savings come from using your own solar instead of buying power, plus a small credit for what you export. Your estimate uses the usage and prices on your bill and NASA sunshine records for your home. Your roof is checked on the confirmation call.",
  },
];

export const SUGGESTED_QUESTIONS: Record<AskContext, string[]> = {
  home: ["How does RENUABL work?", "What will it cost?", "How long does install take?"],
  profile: ["Why do you need my bill?", "I don't have my bill handy", "Do I need a battery?"],
  recommendation: ["Do I need a battery?", "How are savings calculated?", "What if my roof is shaded?"],
  extras: ["Which upgrades are right for me?", "Is a heat pump worth it?", "Can I add these later?"],
  installer: ["How do you choose partners?", "Can I pick someone else?"],
  schedule: ["How long does install take?", "Can I change the date later?"],
  checkout: ["Is the deposit refundable?", "When do I pay the rest?"],
  learn: ["Do I need a battery?", "What rebates can I get?", "How do you size my system?"],
  my: ["How can I improve my savings?", "Why did I use grid power last night?", "Should I add more panels?"],
};

function cannedAnswer(question: string): string {
  const hit = INTENTS.find((i) => i.match.test(question));
  return (
    hit?.answer ??
    (/how.*work/i.test(question)
      ? "Tell us your address and upload your latest bill. We recommend one system sized to your home, match you with a trusted local installation partner, and you choose the install date. A short call confirms the details."
      : "Good question. Your RENUABL specialist will cover that on your 15-minute confirmation call.")
  );
}

export async function askRenuabl(
  question: string,
  context: AskContext,
  snapshot: AskSnapshot = {},
  history: { q: string; a: string }[] = [],
): Promise<AskAnswer> {
  const followUps = SUGGESTED_QUESTIONS[context].filter((q) => q !== question).slice(0, 2);
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, context, snapshot, history }),
    });
    const json = (await res.json()) as { ok: boolean; answer?: string };
    if (json.ok && json.answer) return { answer: json.answer, followUps };
  } catch {
    /* offline or no server: use the reviewed answers */
  }
  return { answer: cannedAnswer(question), followUps };
}
