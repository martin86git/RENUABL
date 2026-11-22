/**
 * Which of a roof's designs go on the next proposal, said plainly (22 Nov 2026, Martin: with several designs it wasn't
 * obvious which was the leading quote, whether the others were on the proposal, or which was recommended; "I might
 * have 5 designs but I only want to offer 1. Or 2. And when offering more than 1, one of them should be recommended").
 * Read from `offeredDesigns`, the same rule publishing uses, so what the designer shows is what goes out.
 */
import { MAX_PROPOSAL_OPTIONS, offeredDesigns, recommendedAt } from "./proposal";
import type { RoofDesign } from "./roof-design";

type Designs = { designs: readonly RoofDesign[]; primary: number };

export interface Lineup {
  /** The designs on the proposal, the leading one first. */
  on: number[];
  /** The one recommended to the customer, when there is more than one; else null. */
  recommended: number | null;
}

export function proposalLineup(set: Designs): Lineup {
  const offered = offeredDesigns({ designs: [...set.designs], primary: set.primary });
  if (offered.length < 2) return { on: [set.primary], recommended: null };
  return {
    on: offered.map((o) => o.at),
    recommended: recommendedAt({ designs: [...set.designs], primary: set.primary }, offered),
  };
}

const named = (at: number) => `Design ${at + 1}`;

/** One line for the top of the designs list. */
export function lineupWords(l: Lineup): string {
  if (l.on.length < 2) return `Only ${named(l.on[0])} goes on the proposal.`;
  const rest = l.on.map((at) => (at === l.recommended ? `${named(at)} (recommended)` : named(at)));
  const list = rest.length === 2 ? rest.join(" and ") : `${rest.slice(0, -1).join(", ")} and ${rest.at(-1)}`;
  return `${l.on.length} options on the proposal: ${list}.`;
}

/**
 * Puts a design on the proposal or takes it off. The line-up is made explicit first (the goal designs that went out
 * by themselves are marked offered), so a press changes only that one. Taking the last option off leaves the leading
 * design alone (marked offered itself). Null when the proposal already holds the most it can.
 */
export function withOnProposal(set: Designs, index: number, on: boolean): RoofDesign[] | null {
  if (index === set.primary) return [...set.designs];
  const now = proposalLineup(set).on;
  const keep = new Set(now.filter((at) => at !== set.primary));
  if (on) {
    if (keep.has(index)) return [...set.designs];
    if (keep.size >= MAX_PROPOSAL_OPTIONS - 1) return null;
    keep.add(index);
  } else keep.delete(index);
  return set.designs.map((d, i) => {
    const next = { ...d };
    delete next.offer;
    if (i === set.primary ? keep.size === 0 : keep.has(i)) next.offer = true;
    if (!(i === set.primary || keep.has(i))) delete next.recommended;
    return next;
  });
}

/** Recommends one design on the proposal (one at most); the leading one is recommended when none is marked. */
export function withRecommended(set: Designs, index: number): RoofDesign[] {
  const explicit = withOnProposal(set, index, true) ?? [...set.designs];
  return explicit.map((d, i) => {
    const next = { ...d };
    delete next.recommended;
    if (i === index) next.recommended = true;
    return next;
  });
}

/**
 * Makes another design the leading one, keeping what is on the proposal: the old leading design stays on as an option
 * when others were on with it.
 */
export function withLeading(set: Designs, index: number): RoofDesign[] {
  const now = proposalLineup(set);
  const many = now.on.length > 1;
  return set.designs.map((d, i) => {
    const next = { ...d };
    if (i === index) delete next.offer;
    if (i === set.primary) {
      if (many) next.offer = true;
      else delete next.offer;
    }
    if (i !== index && i !== set.primary && many) {
      if (now.on.includes(i)) next.offer = true;
      else delete next.offer;
    }
    return next;
  });
}
