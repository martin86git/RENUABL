/**
 * Updates: what has changed in RENUABL, a day a row, newest first, each change in a few words with where it applies
 * (1 Nov 2026, Martin: Primero's copied across, wave 7). Written by hand: add a line here with each change someone
 * using the product would notice, in plain words, never a file or function name. Everyone sees the same list; a count
 * on the gear says how many came in since that person last opened it. Pure, tested.
 */
import type { ISODate } from "../types";

export interface Update {
  day: ISODate;
  area: string;
  words: string;
}

export const UPDATES: readonly Update[] = [
  {
    day: "2026-11-01",
    area: "Proposals",
    words: "Send a new lead an indicative proposal: systems to compare, a site visit, then the final one. They reply in the chat.",
  },
  {
    day: "2026-11-01",
    area: "Proposals",
    words: "Sol can answer customers in their proposal's chat as they write, saying he's an AI (Settings, Emails).",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words:
      "The figures over the picture are three boxes: Solar, Battery, and For this home, which stays red until the customer's bill is in.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words:
      "Panels let go near a traced roof edge or guide line turn square to it and sit clear of it; a new array offers its tilt to change or keep.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words:
      "Opens zoomed in on the roof; the hand drags the picture at any zoom; model numbers in the panel, inverter and battery lists.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A new site asks for the roof pitch first (or that it is flat), then keeps it as a small mark on the picture to change.",
  },
  { day: "2026-11-01", area: "Design tool", words: "Add a panel opens a card: portrait, landscape, or follow the roof face." },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "The whole roof picture fits on the screen, and scrolling moves the page: hold Ctrl (⌘ on a Mac) to zoom.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Designer, Quote and Proposal sit at the top of the column beside the picture; right click the picture for every tool.",
  },
  { day: "2026-11-01", area: "Sol", words: "Copy or pin any message in Sol's chat; pinned ones stay at the top and through Clear." },
  {
    day: "2026-11-01",
    area: "Everywhere",
    words: "The design tool is an orange button in the top bar, and search is the round magnifier beside it.",
  },
  {
    day: "2026-11-01",
    area: "Marketplace",
    words: "Equipment: sell spare panels, inverters and batteries to other businesses, or buy theirs, and message about it.",
  },
  { day: "2026-11-01", area: "Marketplace", words: "Job listings: list a sold job for installers to bid on, or bid on jobs near you." },
  {
    day: "2026-11-01",
    area: "Email",
    words: "Your own Gmail inbox in RENUABL: each email with its customer's deal, private notes, and Sol to sum up or draft a reply.",
  },
  { day: "2026-11-01", area: "Deals", words: "The note-taker: listens to your side of a call and writes up the notes for the deal." },
  { day: "2026-11-01", area: "Users", words: "View as: the owner sees RENUABL exactly as someone in the team does, read only." },
  {
    day: "2026-11-01",
    area: "Settings",
    words: "Updates and Feedback, under the gear: what's new, and a place to raise ideas and issues.",
  },
  {
    day: "2026-11-01",
    area: "Procurement",
    words: "Pre-approvals, Solar Victoria and Book an installation: every sold job at the approval it's waiting on.",
  },
  { day: "2026-11-01", area: "Installation", words: "The install calendar shows the next six weeks booked against what you can do." },
  {
    day: "2026-11-01",
    area: "Installation",
    words: "Job cards: the system, layout and strings for each install, emailed to your installer with a link for their phone.",
  },
  { day: "2026-11-01", area: "Design tool", words: "A design home: deals waiting for a design, designs done this week, recent designs." },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Designer, Quote and Proposal beside the roof, with a timeline of every proposal sent.",
  },
  { day: "2026-11-01", area: "Users", words: "A Designer role: sees every deal, designs and publishes, no settings." },
  {
    day: "2026-11-01",
    area: "Customers",
    words: "Customers and contacts apart, with solar, battery and EV marks, and a group email with unsubscribe.",
  },
  { day: "2026-11-01", area: "Deals", words: "The deal clock and hot, warm or cold with reasons; email opens; attachments on each deal." },
  { day: "2026-11-01", area: "Today", words: "Today: up first, before you call, to action, a calendar and your pipeline in one pad." },
  { day: "2026-11-01", area: "Team chat", words: "Team chat: channels and direct messages, deal cards, files, and @Sol." },
  { day: "2026-11-01", area: "Sol", words: "Sol, your assistant: finds deals, drafts emails, keeps reminders, draws charts." },
  { day: "2026-10-31", area: "Everywhere", words: "A new look: sections across the top, search with Ctrl K, and every page on one pad." },
];

/** The days, newest first, each with its changes. */
export function updatesByDay(list: readonly Update[] = UPDATES): { day: ISODate; items: Update[] }[] {
  const days = [...new Set(list.map((u) => u.day))].sort((a, b) => b.localeCompare(a));
  return days.map((day) => ({ day, items: list.filter((u) => u.day === day) }));
}

/** How many changes came in after the day someone last opened Updates; never opened, the newest day's. */
export function unseenUpdates(seenDay: ISODate | null, list: readonly Update[] = UPDATES): number {
  if (!list.length) return 0;
  if (!seenDay) {
    const newest = list.reduce((d, u) => (u.day > d ? u.day : d), list[0].day);
    return list.filter((u) => u.day === newest).length;
  }
  return list.filter((u) => u.day > seenDay).length;
}

/** The newest day on the list: what opening Updates marks as seen. */
export const newestDay = (list: readonly Update[] = UPDATES): ISODate | null =>
  list.length ? list.reduce((d, u) => (u.day > d ? u.day : d), list[0].day) : null;
