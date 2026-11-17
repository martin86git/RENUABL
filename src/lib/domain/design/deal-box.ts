/**
 * What typed into Sol's box on a deal means when it is plainly a wish to open one of the deal's tools (18 Nov 2026,
 * Martin: he typed "lets start the design" and was sent to Sol's panel to say it again: "simply typing it into the
 * primary box in the deal page should launch the designer"). Read by rule, at once, no Sol credit: a short line that
 * asks to start or open the design, or the proposal, opens it. Anything with more to it (a size, a product, a question,
 * something to send) still goes to Sol.
 */
export type BoxMove = "design" | "proposal";

const BOX_MOVE_WORDS_MAX = 10;

/** Words that mean there is more to the wish than opening the tool, so Sol should hear it. */
const MORE_TO_IT =
  /\d|\?|\b(why|what|how|when|where|who|which|should|could|would|can|does|did|is|are|was|kw|kwh|panel|panels|battery|batteries|inverter|charger|email|text|send|sent|call|tell|ask|explain|compare|change|cheaper|price|cost|about|with|without|and then|after|before|because)\b/;

const GO =
  "(?:start|begin|open|launch|do|make|create|build|draw|get|show|view|see|go to|go into|take me to|bring up|pull up|kick off|get started on|get going on|crack on with)";
const THE = "(?:the|a|an|this|that|his|her|their|its|my|our|up the|on the|with the)?";
const SOFT =
  "(?:please|pls|now|then|ok|okay|sol|hey sol|hi sol|can you|lets|let s|let us|i want to|i d like to|we should|time to|ready to)";

const DESIGN = new RegExp(
  `^(?:${SOFT}\\s+)*(?:${GO}\\s+${THE}\\s*(?:roof\\s+)?(?:design|designer|designing|design tool|roof designer)|design\\s+(?:it|this|that|the roof|his roof|her roof|their roof|the system|this roof|the home|the house)|design|designer)(?:\\s+(?:for (?:him|her|them|this|it)|${SOFT}))*$`,
);
const PROPOSAL = new RegExp(
  `^(?:${SOFT}\\s+)*(?:${GO}|write|prepare|draft)\\s+${THE}\\s*(?:proposal|quote)(?:\\s+(?:for (?:him|her|them|this|it)|${SOFT}))*$`,
);

/** Lower case, apostrophes and punctuation out, one space between words. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9? ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The deal's tool a line typed to Sol plainly asks for, else null (Sol hears it). The customer's first name may be in
 * it ("start Roberto's design").
 */
export function boxMove(text: string, firstName = ""): BoxMove | null {
  let t = plain(text);
  if (!t) return null;
  const name = plain(firstName);
  if (name)
    t = t
      .replace(new RegExp(`\\b(?:for )?${name}(?: s)?\\b`, "g"), " ")
      .replace(/\s+/g, " ")
      .trim();
  if (!t || t.split(" ").length > BOX_MOVE_WORDS_MAX) return null;
  // "can you" opens softly; any other question word means Sol should answer.
  const rest = t.replace(/^(?:(?:hey |hi )?sol )?can you /, "");
  if (MORE_TO_IT.test(rest)) return null;
  if (DESIGN.test(t)) return "design";
  if (PROPOSAL.test(t)) return "proposal";
  return null;
}
