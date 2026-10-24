/**
 * The overview as a blank canvas (25 Oct 2026, Martin: software shows what it assumes you'll need before you ask, and
 * may guess wrong; Claude shows what you ask for. So the overview starts plain, with a greeting and a box at the
 * bottom, and what is asked for appears). A question is answered in a few plain words from the business's own figures,
 * and the panel that shows it is drawn under the answer: the journey, today, sales, upcoming or completed installs.
 * Without Claude, the words of the question pick the panel. Pure, tested.
 */
import { STAGE_LABELS, type Job } from "./crm";
import { journey, journeyStopOf, JOURNEY_WORDS, type JourneyStop } from "./journey";

export const CANVAS_PANELS = ["journey", "today", "sales", "upcoming", "completed"] as const;
export type CanvasPanel = (typeof CANVAS_PANELS)[number];

export const PANEL_WORDS: Record<CanvasPanel, string> = {
  journey: "every job, from enquiry to service",
  today: "what needs doing today",
  sales: "sales against the month's goals",
  upcoming: "installs still to come",
  completed: "installs done and their paperwork",
};

/** Ready-made questions, so the canvas can be used without typing. */
export const CANVAS_STARTERS: readonly { label: string; question: string }[] = [
  { label: "Where is every job?", question: "Where is every job?" },
  { label: "What needs doing today?", question: "What needs doing today?" },
  { label: "How are sales going?", question: "How are sales going this month?" },
  { label: "What's being installed?", question: "What installs are coming up?" },
];

export const CANVAS_GREETING = "What would you like to see?";

type CanvasJob = Pick<Job, "stage" | "details" | "value" | "installDate" | "kw" | "title" | "wonAt"> & { customerName: string };

const ALL_PATHS = Object.fromEntries(Object.keys(JOURNEY_WORDS).map((k) => [k, ""])) as Record<JourneyStop, string>;

/**
 * The business as plain lines for Claude to answer from: the journey's counts, then each live job with its stop, stage,
 * value and install date (customer first names only, at most 60 jobs). Nothing more: no emails, phones or addresses.
 */
export function canvasFacts(jobs: readonly CanvasJob[], serviceOpen: number, today: string): string {
  const lines = [`Today is ${today}.`, "Jobs at each stop of the journey:"];
  for (const s of journey(jobs, serviceOpen, ALL_PATHS)) lines.push(`- ${s.name} (${s.what}): ${s.count}`);
  // Sales: what was sold this month and so far this financial year (from 1 July).
  const month = today.slice(0, 7);
  const fyStart = `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 7 ? 1 : 0)}-07-01`;
  const sold = (from: string) => jobs.filter((j) => j.wonAt && j.wonAt.slice(0, 10) >= from && j.stage !== "lost");
  const sum = (list: readonly CanvasJob[]) =>
    `${list.length} ${list.length === 1 ? "deal" : "deals"}, $${Math.round(list.reduce((n, j) => n + (j.value ?? 0), 0)).toLocaleString("en-AU")}, ${Math.round(list.reduce((n, j) => n + (j.kw ?? 0), 0) * 10) / 10} kW`;
  lines.push(
    "",
    `Sold this month (${month}): ${sum(sold(`${month}-01`))}`,
    `Sold this financial year (from ${fyStart}): ${sum(sold(fyStart))}`,
  );
  const live = jobs.filter((j) => j.stage !== "lost").slice(0, 60);
  if (live.length) lines.push("", "Jobs:");
  for (const j of live) {
    const stop = journeyStopOf(j);
    const first = j.customerName.split(/\s+/)[0] || "A customer";
    const bits = [
      `${first}: ${j.title}`,
      `stop ${stop ? JOURNEY_WORDS[stop].name : "none"}`,
      `stage ${STAGE_LABELS[j.stage]}`,
      j.value ? `value $${Math.round(j.value).toLocaleString("en-AU")}` : null,
      j.kw ? `${j.kw} kW` : null,
      j.wonAt ? `sold ${j.wonAt.slice(0, 10)}` : null,
      j.installDate ? `install ${j.installDate}` : null,
    ].filter(Boolean);
    lines.push(`- ${bits.join(", ")}`);
  }
  const lost = jobs.length - jobs.filter((j) => j.stage !== "lost").length;
  if (lost) lines.push("", `Lost deals: ${lost}`);
  return lines.join("\n");
}

/** How Claude answers on the canvas: briefly, from the facts only, and naming the panel to draw on a last line. */
export function canvasSystemPrompt(business: string, facts: string): string {
  return [
    `You are the overview of RENUABL, the software ${business || "this solar business"} runs its business on: leads, designs and quotes, sales, approvals, procurement, installs, post-install paperwork and service.`,
    "Answer the person's question in one to three short, plain sentences, from the facts below only. Never invent a figure, a name or a date. If the facts don't say, say so plainly.",
    "No headings, lists or markdown. No sign-off.",
    `After the answer, if one of these panels would show what they asked for, add a last line "SHOW: <panel>" with one or two of: ${CANVAS_PANELS.map((p) => `${p} (${PANEL_WORDS[p]})`).join(", ")}. Always add it when the question is about the business: the panel shows the detail even when your words can't. Leave it out only for small talk.`,
    "",
    "Facts:",
    facts,
  ].join("\n");
}

/** The answer's words and the panels it asked for, from Claude's text. Unknown panels are dropped. */
export function readCanvasAnswer(text: string): { reply: string; show: CanvasPanel[] } {
  const show: CanvasPanel[] = [];
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*SHOW:\s*(.+)$/i);
    if (!m) {
      kept.push(line);
      continue;
    }
    for (const word of m[1].split(/[\s,]+/)) {
      const p = word.toLowerCase().replace(/[^a-z]/g, "") as CanvasPanel;
      if (CANVAS_PANELS.includes(p) && !show.includes(p)) show.push(p);
    }
  }
  return { reply: kept.join("\n").trim(), show: show.slice(0, 2) };
}

const CUES: [CanvasPanel, RegExp][] = [
  ["today", /\b(today|to ?do|need(s)? doing|waiting|follow.?ups?|messages?)\b/i],
  ["sales", /\b(sales?|sold|revenue|targets?|goals?|month|kw sold|conversion)\b/i],
  ["upcoming", /\b(upcoming|coming up|booked|book|schedule|install(s|ation|ations)?( coming)?|next week|this week)\b/i],
  ["completed", /\b(completed|done|finished|paperwork|stcs?|grid|invoices?)\b/i],
  ["journey", /\b(journey|every job|all (the )?jobs|where|pipeline|deals?|enquir(y|ies)|leads?|approvals?|overview|everything)\b/i],
];

/** Without Claude: the panel the question's words point to, and a line to go with it. */
export function guessCanvas(question: string): { reply: string; show: CanvasPanel[] } {
  const hit = CUES.find(([, re]) => re.test(question));
  if (!hit) return { reply: `I can show you ${CANVAS_PANELS.map((p) => PANEL_WORDS[p]).join("; ")}.`, show: [] };
  return { reply: `Here's ${PANEL_WORDS[hit[0]]}.`, show: [hit[0]] };
}
