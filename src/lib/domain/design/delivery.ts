/**
 * How a voice agent speaks (16 Nov 2026, Martin: "the ability to program the voice agent so it doesn't sound so
 * scripted. It pauses, breathes, doesn't ramble off an opening, treats it like an actual phone call"). The business
 * chooses its manner, pace, how it opens, how long it leaves before answering and whether there is a room behind it;
 * the choices become instructions after every rule (`deliveryBlock`) and two of Vapi's call settings (`deliveryParams`).
 *
 * A sales agent nobody has set speaks as a natural phone call (17 Nov 2026, Martin: "make natural delivery the default
 * for Charlie"); the post-sale agent is plain until chosen (`defaultDelivery`). None of it changes what the agent may
 * say: it always says it is automated, and every rule holds. Pure, tested.
 */

export const MANNERS = ["plain", "natural"] as const;
export const PACES = ["relaxed", "steady", "brisk"] as const;
export const OPENINGS = ["word", "easy"] as const;
export const PAUSES = ["quick", "considered", "unhurried"] as const;
export const ROOMS = ["office", "silent"] as const;

export interface Delivery {
  /** natural: talks as a person on the phone does; plain: the calls as they were. */
  manner: (typeof MANNERS)[number];
  pace: (typeof PACES)[number];
  /** word: the opening word for word; easy: who it is in a few words, a beat, then why it's calling. */
  opening: (typeof OPENINGS)[number];
  /** How long it leaves after they stop talking before it answers. */
  pause: (typeof PAUSES)[number];
  /** A quiet office behind it (Vapi's own default on phone calls), or nothing. */
  room: (typeof ROOMS)[number];
}

/** The calls as they were before anything was chosen. */
export const DEFAULT_DELIVERY: Delivery = { manner: "plain", pace: "steady", opening: "word", pause: "quick", room: "office" };

/** One press: a natural phone call. */
export const NATURAL_DELIVERY: Delivery = { manner: "natural", pace: "relaxed", opening: "easy", pause: "considered", room: "office" };

/** How an agent speaks while nobody has chosen: a sales agent naturally, the post-sale one plainly. */
export const defaultDelivery = (sales: boolean): Delivery => (sales ? NATURAL_DELIVERY : DEFAULT_DELIVERY);

const pick = <T extends string>(list: readonly T[], raw: unknown, or: T): T => (list.includes(raw as T) ? (raw as T) : or);

/** What was sent or kept, as a whole valid choice; anything unknown is the default for that part. */
export function cleanDelivery(raw: unknown): Delivery {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    manner: pick(MANNERS, d.manner, DEFAULT_DELIVERY.manner),
    pace: pick(PACES, d.pace, DEFAULT_DELIVERY.pace),
    opening: pick(OPENINGS, d.opening, DEFAULT_DELIVERY.opening),
    pause: pick(PAUSES, d.pause, DEFAULT_DELIVERY.pause),
    room: pick(ROOMS, d.room, DEFAULT_DELIVERY.room),
  };
}

export const sameDelivery = (a: Delivery, b: Delivery): boolean =>
  a.manner === b.manner && a.pace === b.pace && a.opening === b.opening && a.pause === b.pause && a.room === b.room;

/** Seconds Vapi waits after the customer stops before the agent speaks (its own default is 0.4). */
export const PAUSE_SECONDS: Record<Delivery["pause"], number> = { quick: 0.4, considered: 0.8, unhurried: 1.2 };

/**
 * Vapi's settings for the call (`startSpeakingPlan.waitSeconds`, `backgroundSound`, both on the transient assistant;
 * read from docs.vapi.ai on 16 Nov 2026). Only what differs from Vapi's own defaults is sent, so an agent nobody has
 * changed sends nothing new.
 */
export function deliveryParams(d: Delivery | null | undefined): Record<string, unknown> {
  if (!d) return {};
  return {
    ...(d.pause !== "quick" ? { startSpeakingPlan: { waitSeconds: PAUSE_SECONDS[d.pause] } } : {}),
    ...(d.room === "silent" ? { backgroundSound: "off" } : {}),
  };
}

const PACE_LINES: Record<Delivery["pace"], string> = {
  relaxed: "Pace: unhurried. Take your time, and leave a beat between one thought and the next.",
  steady: "",
  brisk: "Pace: keep it moving. Brief answers, no preamble, and get to the point of the call early.",
};

/**
 * The manner as instructions, after every rule the agent keeps. Empty for the calls as they were. A voice can't
 * breathe; what reads as breath on a call is short turns, commas and the odd beat, so that is what it is asked for.
 */
export function deliveryBlock(d: Delivery | null | undefined): string {
  if (!d) return "";
  const lines: string[] = [];
  if (d.manner === "natural")
    lines.push(
      `Talk the way a person does on the phone, not like someone reading:
- One short thought, then stop and let them speak. Never more than two sentences in a row before they've had a turn, unless they asked you to explain something.
- Begin a reply the way people do, with a small acknowledgement of what they just said ("Yeah, of course.", "Right, okay.", "Mm, fair enough.", "Oh, nice."). Vary them, never the same one twice running, and leave it out when it doesn't fit.
- Leave room to breathe. Put a comma or a full stop where a person would take a breath, and now and then an ellipsis for a beat of thought ("So... what's got you looking at solar?"). An occasional "um" or "so" is fine; never more than one in a turn.
- Always contractions. No lists, no "firstly", no "I'd be happy to assist", no "great question", and don't say their name in every turn.
- If they start talking while you are, stop at once and listen. Don't finish your sentence and don't start it again from the top.
- Match them: brief with someone brisk, easy with someone chatty. If they sound busy or distracted, say so kindly and offer to ring back.
- When you don't know something, say so the way a person would ("I'm not sure, actually... let me get the team to come back to you on that").`,
    );
  if (PACE_LINES[d.pace]) lines.push(PACE_LINES[d.pace]);
  if (!lines.length) return "";
  return `## How you sound
The business has chosen how you speak on calls. This shapes your delivery only: every rule above still holds, you still say you're automated, and the figures and facts are still only the ones you were given.
${lines.join("\n")}`;
}

/** The choices in words, for the window. */
export const DELIVERY_COPY = {
  title: "How it speaks",
  summary: (d: Delivery | null): string =>
    !d || sameDelivery(d, DEFAULT_DELIVERY)
      ? "As it comes: clear and to the script"
      : `${d.manner === "natural" ? "Natural" : "Plain"}, ${d.pace}, ${d.opening === "easy" ? "an easy opening" : "opening word for word"}`,
  preset: "Make it a natural phone call",
  presetNote: "Short turns, small acknowledgements, room to breathe, and an opening in two easy beats.",
  reset: "Make it plain again",
  note: "It always says it's your automated assistant, and none of this changes what it may say.",
  parts: {
    manner: {
      label: "Manner",
      options: { plain: ["Plain", "Clear and to the script"], natural: ["Natural", "Short turns, acknowledgements, a beat to think"] },
    },
    pace: {
      label: "Pace",
      options: { relaxed: ["Relaxed", "Unhurried"], steady: ["Steady", "As it comes"], brisk: ["Brisk", "Gets to the point"] },
    },
    opening: {
      label: "Opening",
      options: {
        word: ["Word for word", "Who and why in one line"],
        easy: ["Easy", "Who it is, a beat, then why it's ringing"],
      },
    },
    pause: {
      label: "Before it answers",
      options: {
        quick: ["Quick", "Answers straight away"],
        considered: ["A moment", "Lets them finish their thought"],
        unhurried: ["Unhurried", "Never talks over a slow talker"],
      },
    },
    room: { label: "Behind it", options: { office: ["A quiet office", "A little room noise"], silent: ["Silence", "Nothing at all"] } },
  },
} as const;
