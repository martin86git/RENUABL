/**
 * "Ask RENUABL" answers. Today this is a small intent matcher over canned,
 * reviewed answers; later it can call a model with the same signature.
 */

export type AskContext = "home" | "profile" | "recommendation" | "extras" | "installer" | "schedule" | "checkout" | "my";

export interface AskAnswer {
  answer: string;
  followUps: string[];
}

const INTENTS: { match: RegExp; answer: string }[] = [
  {
    match: /battery|batteries|storage|night|evening/i,
    answer:
      "A battery stores the solar you don't use during the day so your home can run on it at night. We only recommend one when it pays for itself for your household. You can remove it on your recommendation screen at any time.",
  },
  {
    match: /heat pump|hot water|upgrade|switchboard|smart home/i,
    answer:
      "Upgrades are worth it when they move energy use into the daytime, when your solar is free. A heat pump hot water system is usually the biggest win. You can add any of them now or later from My RENUABL.",
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
      "Reserving your date is free. The $499 deposit is only asked for after your confirmation call, and it's fully refundable until your installer confirms the site visit. If anything doesn't feel right, we'll refund it, no questions asked.",
  },
  {
    match: /install|how long|day|takes/i,
    answer:
      "Most homes are done in a single day. Your installer arrives at the time you pick, and you'll get a message when they're on the way and when they're finished.",
  },
  {
    match: /installer|who|trust|licen[cs]ed|accredit/i,
    answer:
      "Every RENUABL installer is licensed, accredited and reviewed on every job. We match you with the one with the best track record in your area and the right availability.",
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
      "Savings come from using your own solar instead of buying power, plus a small credit for what you export. Your estimate uses the usage and prices on your bill and average Melbourne sunshine. Your roof is checked on the confirmation call.",
  },
];

export const SUGGESTED_QUESTIONS: Record<AskContext, string[]> = {
  home: ["How does RENUABL work?", "What will it cost?", "How long does install take?"],
  profile: ["Why do you need my bill?", "Which bill should I upload?", "Do I need a battery?"],
  recommendation: ["Do I need a battery?", "How are savings calculated?", "What if my roof is shaded?"],
  extras: ["Which upgrades are right for me?", "Is a heat pump worth it?", "Can I add these later?"],
  installer: ["How do you choose installers?", "Can I pick someone else?"],
  schedule: ["How long does install take?", "Can I change the date later?"],
  checkout: ["Is the deposit refundable?", "When do I pay the rest?"],
  my: ["How can I improve my savings?", "Why did I use grid power last night?", "Should I add more panels?"],
};

export async function askRenuabl(question: string, context: AskContext): Promise<AskAnswer> {
  await new Promise((r) => setTimeout(r, 600));
  const hit = INTENTS.find((i) => i.match.test(question));
  const answer =
    hit?.answer ??
    (/how.*work/i.test(question)
      ? "Tell us your address and a few things about your home. We recommend a system, match you with a trusted local installer, and you choose the install date. A short call confirms the details — that's it."
      : "Good question. A RENUABL energy specialist will cover that on your confirmation call. In the meantime, everything on this screen can be changed later.");
  return { answer, followUps: SUGGESTED_QUESTIONS[context].filter((q) => q !== question).slice(0, 2) };
}
