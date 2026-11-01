/**
 * Server only. Sol answering a member (domain/design/sol.ts): Claude with tools over the business's own deals as this
 * member may see them (`viewerOf`). Nothing here sends anything to anyone: an email he writes is a draft card for the
 * member to send from the deal. Preferences and reminders change in the member's own row as each tool runs; the
 * question and answer are kept together at the end.
 */
import Anthropic from "@anthropic-ai/sdk";
import { can } from "@/lib/domain/design/account";
import { canvasFacts } from "@/lib/domain/design/canvas";
import { cleanChart, CHARTS_PER_TURN, type SolChart } from "@/lib/domain/design/sol-charts";
import { cleanDiagram, DIAGRAMS_PER_TURN, type SolDiagram } from "@/lib/domain/design/sol-diagrams";
import {
  DRAFTS_PER_TURN,
  HISTORY_SENT,
  dealLine,
  dealsAtStage,
  dueFor,
  dueWords,
  findDeals,
  fromLocal,
  solSystem,
  upcoming,
  withPref,
  withReminder,
  withoutPref,
  type SolDraft,
  type SolFile,
  type SolJob,
  type SolReminderAsk,
  type SolState,
  type SolTurn,
  type WhenChoice,
} from "@/lib/domain/design/sol";
import { todayInMarket } from "@/lib/domain/market";
import { redactSecrets } from "./bill-reader";
import { viewerOf } from "./design-context";
import { customerDetail, jobById, listCustomers, listJobs } from "./design-crm-repo";
import { loadLists, type Member } from "./design-repo";
import { casesToResolve } from "./design-service-repo";
import { addSolTurns, newSolId, solState, withSol } from "./design-sol-repo";
import { giveBackSolCredit, takeSolCredit } from "./sol-credits";
import { SOL_OUT, type SolUse } from "@/lib/domain/design/sol-credits";
import { channelContext, solSaysInTeam } from "./design-team-repo";
import { listSheets } from "./design-datasheets-repo";
import { listStandards } from "./design-standards-repo";
import { libraryForSol } from "@/lib/domain/design/standards";
import { datasheetFigures } from "@/lib/domain/design/datasheets";
import { TEAM_CHANNELS, nameOf } from "@/lib/domain/design/team-chat";

const MODEL = () => process.env.SOL_MODEL?.trim() || "claude-opus-5-5";
const STEPS = 6;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "find_deal",
    description:
      "Find deals by the customer's name, the address, the deal's title, a phone number or the deal's id. Gives each deal in a line with its id.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "deal_details",
    description:
      "Everything known about one deal: the customer (name, phone, email, address, source, notes), the deal's stage, value, kW, install date, owner and system details, and its latest activity (notes, calls, emails, stage moves, proposals, messages). Use it before advising on, or writing to, any customer.",
    input_schema: { type: "object", properties: { deal_id: { type: "string" } }, required: ["deal_id"] },
  },
  {
    name: "deals_at_stage",
    description:
      'The deals at a stage (say "lead", "proposal sent", "won", "installed"; part of the name will do), longest unchanged first, each with how many days since it last changed. With no stage, every stage and how many deals it holds.',
    input_schema: { type: "object", properties: { stage: { type: "string" } } },
  },
  {
    name: "draft_email",
    description:
      "Write an email to the customer on a deal. It is shown in the chat as a draft card for the person to check, change and send from the deal's Email tab: this tool never sends. Write the subject and the whole email.",
    input_schema: {
      type: "object",
      properties: { deal_id: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
      required: ["deal_id", "subject", "body"],
    },
  },
  {
    name: "remember_my_preference",
    description: "Keep a lasting preference of this person's for the emails you write for them (a sign-off, their name and title, a tone).",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "forget_my_preference",
    description: "Take one of this person's preferences off, by its id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "add_reminder",
    description:
      "Keep a reminder for this person. Without a time, it waits for one and the times (in 1 hour, in 4 hours, end of day, tomorrow) are offered as buttons under your answer. With a time they gave, it is set for then.",
    input_schema: {
      type: "object",
      properties: {
        what: {
          type: "string",
          description: 'What to remind them of, as they\'d want to read it then ("Call Casey back about the battery").',
        },
        when_local: { type: "string", description: "Only when they gave a time: local time as YYYY-MM-DD HH:mm." },
      },
      required: ["what"],
    },
  },
  {
    name: "set_reminder_time",
    description: "Set when one of this person's reminders is due. Without reminder_id, the latest one still waiting for a time.",
    input_schema: {
      type: "object",
      properties: { when_local: { type: "string", description: "Local time as YYYY-MM-DD HH:mm." }, reminder_id: { type: "string" } },
      required: ["when_local"],
    },
  },
  {
    name: "list_reminders",
    description: "This person's reminders still to come (and any waiting for a time), soonest first, with their ids.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "remove_reminder",
    description: "Take one of this person's reminders off, by its id.",
    input_schema: { type: "object", properties: { reminder_id: { type: "string" } }, required: ["reminder_id"] },
  },
  {
    name: "standards_on_file",
    description:
      "Which standards the business holds in its library (its own licensed copies, with their editions), which of the usual ones it doesn't, and the official free sources. It gives no standard's text: say which clause to look up in their copy.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "datasheet_lookup",
    description:
      "The checked electrical figures of panels and inverters from the business's own datasheets (Settings, Product datasheets) and RENUABL's, by product code or model words: panel Voc, Vmp, Isc, Imp and temperature coefficients; inverter max input voltage, MPPT range, start voltage and each MPPT's current and strings.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "show_chart",
    description:
      "Draw a chart under your answer from figures the facts or a tool gave you (never figures you guessed). kind: 'funnel' for steps people go through, 'bars' for things side by side, 'columns' for one figure over time, oldest first. One series.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["funnel", "bars", "columns"] },
        title: { type: "string" },
        unit: { type: "string" },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, note: { type: "string" } },
            required: ["label", "value"],
          },
        },
        note: { type: "string" },
      },
      required: ["kind", "title", "rows"],
    },
  },
  {
    name: "show_diagram",
    description:
      "Draw a labelled diagram under your answer that shows a real case better than words (a battery's clearances, a roof's setbacks, how strings run to an inverter, a switchboard's layout). One SVG with a viewBox (about 0 0 720 420) and no width or height; drawing elements only (rect, line, path, polygon, circle, text, g, defs, marker); no script, style, image or links; under about 6,000 characters.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, svg: { type: "string" }, caption: { type: "string" } },
      required: ["title", "svg"],
    },
  },
];

/** Only for a member who may see costs. */
const PRICE_TOOL: Anthropic.Tool = {
  name: "price_lookup",
  description:
    "Products on the business's uploaded price lists whose name or code has every word given (a maker, a model, a size like 475 or 10kw, or a code): each with its supplier cost ex GST and the list it is on.",
  input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
};

interface Turn {
  charts: SolChart[];
  diagrams: SolDiagram[];
  drafts: SolDraft[];
  reminder?: SolReminderAsk;
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function runTool(
  member: Member,
  name: string,
  input: Record<string, unknown>,
  jobs: SolJob[],
  phones: Map<string, string>,
  shown: Turn,
): Promise<string> {
  const { businessId, email } = member;
  const viewer = viewerOf(member);
  if (name === "find_deal") {
    const found = findDeals(jobs, s(input.query), (c) => phones.get(c) ?? "");
    return found.length ? found.map(dealLine).join("\n") : "No deal matches that.";
  }
  if (name === "deal_details") {
    const got = await jobById(businessId, s(input.deal_id), viewer);
    if (!got) return "There's no such deal, or this person can't see it.";
    const { job, customer } = got;
    const detail = await customerDetail(businessId, customer.id, viewer);
    const activity = (detail?.activity ?? []).filter((a) => !a.jobId || a.jobId === job.id).slice(0, 15);
    const details = Object.entries(job.details).filter(([, v]) => v);
    return [
      `Customer: ${customer.name}${customer.sample ? " (a made-up sample customer)" : ""} · phone ${customer.phone || "none"} · email ${customer.email || "none"} · ${customer.address || "no address"}`,
      customer.source ? `Source: ${customer.source}` : "",
      customer.notes ? `Notes on the customer: ${customer.notes}` : "",
      `Deal: ${dealLine({ ...job, customerName: customer.name })}`,
      `Owner: ${job.owner ?? "no one yet"} · made ${job.createdAt.slice(0, 10)}${job.wonAt ? ` · sold ${job.wonAt.slice(0, 10)}` : ""}${job.installedAt ? ` · installed ${job.installedAt.slice(0, 10)}` : ""}`,
      details.length ? `Details typed in: ${details.map(([k, v]) => `${k}: ${v}`).join("; ")}` : "",
      activity.length ? "Latest activity, newest first:" : "No activity yet.",
      ...activity.map((a) => `- ${a.at.slice(0, 10)} ${a.kind} by ${a.by}: ${a.text.replace(/\s+/g, " ").slice(0, 400)}`),
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (name === "deals_at_stage") return dealsAtStage(jobs, s(input.stage), todayInMarket());
  if (name === "price_lookup") {
    if (!can(member.role, "costs", member.permissions)) return "This person can't see costs.";
    const words = s(input.query).toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return "Say what to look for.";
    const lists = await loadLists(businessId);
    if (!lists.length) return "No price lists are uploaded yet (Settings, Pricing).";
    const hits = lists.flatMap((l) =>
      l.items
        .filter((i) => words.every((w) => `${i.sku} ${i.name}`.toLowerCase().includes(w)))
        .map((i) => `${i.sku} · ${i.name} · $${i.cost.toFixed(2)} ex GST · ${l.name}`),
    );
    return hits.length ? hits.slice(0, 25).join("\n") : "Nothing on the price lists matches that.";
  }
  if (name === "draft_email") {
    if (shown.drafts.length >= DRAFTS_PER_TURN) return `Only ${DRAFTS_PER_TURN} drafts an answer.`;
    const got = await jobById(businessId, s(input.deal_id), viewer);
    if (!got) return "There's no such deal, or this person can't see it.";
    shown.drafts.push({
      jobId: got.job.id,
      customer: got.customer.name,
      to: got.customer.email,
      subject: s(input.subject).slice(0, 200),
      body: s(input.body).slice(0, 6000),
    });
    return `Shown as a draft card to ${got.customer.name}${got.customer.email ? "" : " (who has no email address yet: say so)"}.`;
  }
  if (name === "remember_my_preference") {
    await withSol(businessId, email, (row) => ({ ...row, prefs: withPref(row.prefs, s(input.text), newSolId(), new Date()) }));
    return "Kept: it applies to every email you write for them from now.";
  }
  if (name === "forget_my_preference") {
    await withSol(businessId, email, (row) => ({ ...row, prefs: withoutPref(row.prefs, s(input.id)) }));
    return "Taken off.";
  }
  if (name === "add_reminder" || name === "set_reminder_time") {
    const when = s(input.when_local);
    const at = when ? fromLocal(when) : null;
    if (when && !at) return `"${when}" isn't a time I can read: give it as YYYY-MM-DD HH:mm.`;
    if (at && at.getTime() <= Date.now()) return "That time has already passed.";
    if (name === "add_reminder") {
      const what = s(input.what).slice(0, 500);
      if (!what) return "Say what to remind them of.";
      const r = { id: newSolId(), what, createdAt: new Date().toISOString(), ...(at ? { dueAt: at.toISOString() } : {}) };
      await withSol(businessId, email, (row) => ({ ...row, reminders: withReminder(row.reminders, r) }));
      shown.reminder = { id: r.id, what: r.what, ...(r.dueAt ? { dueAt: r.dueAt } : {}) };
      return r.dueAt ? `Kept: I'll remind them ${dueWords(r.dueAt)}.` : "Kept, waiting for a time: the times are under your answer.";
    }
    let set: { id: string; what: string; dueAt: string } | null = null;
    await withSol(businessId, email, (row) => {
      const id = s(input.reminder_id);
      const target = id
        ? row.reminders.find((r) => r.id === id && !r.firedAt)
        : row.reminders.filter((r) => !r.firedAt && !r.dueAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!target || !at) return row;
      set = { id: target.id, what: target.what, dueAt: at.toISOString() };
      return { ...row, reminders: row.reminders.map((r) => (r.id === target.id ? { ...r, dueAt: at.toISOString() } : r)) };
    });
    if (!set) return "There's no reminder waiting for a time.";
    shown.reminder = set;
    return `Set: I'll remind them ${dueWords((set as { dueAt: string }).dueAt)}.`;
  }
  if (name === "list_reminders") {
    const list = upcoming((await solState(businessId, email)).reminders);
    return list.length
      ? list.map((r) => `- ${r.id}: ${r.what} · ${r.dueAt ? dueWords(r.dueAt) : "waiting for a time"}`).join("\n")
      : "No reminders to come.";
  }
  if (name === "remove_reminder") {
    await withSol(businessId, email, (row) => ({ ...row, reminders: row.reminders.filter((r) => r.id !== s(input.reminder_id)) }));
    return "Taken off.";
  }
  if (name === "standards_on_file") return libraryForSol(await listStandards(businessId));
  if (name === "datasheet_lookup") return datasheetFigures(await listSheets(businessId), s(input.query));
  if (name === "show_chart") {
    const c = cleanChart(input);
    if (!c) return "That chart couldn't be drawn: it needs a title and rows of numbers.";
    if (shown.charts.length >= CHARTS_PER_TURN) return "That's enough charts for one answer.";
    shown.charts.push(c);
    return "Drawn under your answer.";
  }
  if (name === "show_diagram") {
    const d = cleanDiagram(input);
    if (!d) return "That diagram couldn't be drawn: one <svg> with a viewBox, drawing elements only.";
    if (shown.diagrams.length >= DIAGRAMS_PER_TURN) return "That's enough diagrams for one answer.";
    shown.diagrams.push(d);
    return "Drawn under your answer.";
  }
  return "There's no such tool.";
}

function fileBlocks(files: readonly SolFile[]): Anthropic.ContentBlockParam[] {
  return files.map((f) =>
    f.type === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: f.data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: f.type as "image/png", data: f.data } },
  );
}

/** Sol answers what the member said (with any files) and both are kept in their conversation. */
export async function askSol(
  member: Member,
  said: { text: string; files: SolFile[] },
  apiKey: string | null,
  use: SolUse = "chat",
): Promise<SolState> {
  const { businessId, email } = member;
  const named = said.files.map((f) => f.name);
  const text = (said.text || "Here's what I've attached.") + (named.length ? `\n(Attached: ${named.join(", ")})` : "");
  const asked = new Date().toISOString();
  const you: SolTurn = { role: "you", text, at: asked };
  if (!apiKey) {
    return addSolTurns(businessId, email, [
      you,
      {
        role: "sol",
        text: "I can't answer just now: Claude isn't set up on this site yet (ANTHROPIC_API_KEY).",
        at: new Date().toISOString(),
      },
    ]);
  }
  // One credit an answer, taken before Claude is asked and given back when no answer comes.
  const credit = await takeSolCredit(businessId, use, email);
  if (!credit) return addSolTurns(businessId, email, [you, { role: "sol", text: SOL_OUT, at: new Date().toISOString() }]);
  const viewer = viewerOf(member);
  const [state, jobs, customers, serviceOpen] = await Promise.all([
    solState(businessId, email),
    listJobs(businessId, viewer),
    listCustomers(businessId),
    casesToResolve(businessId),
  ]);
  const visible = new Set(jobs.map((j) => j.customerId));
  const phones = new Map(customers.filter((c) => visible.has(c.id)).map((c) => [c.id, c.phone]));
  const system = solSystem({
    business: member.businessName,
    member: email,
    costs: can(member.role, "costs", member.permissions),
    facts: canvasFacts(jobs, serviceOpen, todayInMarket()),
    prefs: state.prefs,
    now: new Date(),
  });
  const tools = can(member.role, "costs", member.permissions) ? [...TOOLS, PRICE_TOOL] : TOOLS;
  const blocks = fileBlocks(said.files);
  const messages: Anthropic.MessageParam[] = [
    ...state.turns
      .slice(-HISTORY_SENT)
      .map((t) => ({ role: t.role === "you" ? ("user" as const) : ("assistant" as const), content: t.text || "(drawn)" })),
    { role: "user", content: blocks.length ? [...blocks, { type: "text" as const, text }] : text },
  ];
  // The API wants the conversation to start with the person and to alternate.
  while (messages.length && messages[0].role !== "user") messages.shift();
  const merged: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role && typeof last.content === "string" && typeof m.content === "string")
      last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }

  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const shown: Turn = { charts: [], diagrams: [], drafts: [] };
  let answer = "";
  try {
    for (let step = 0; step < STEPS; step++) {
      const m = await client.messages.create({ model: MODEL(), max_tokens: 8000, system, tools, messages: merged });
      answer =
        m.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim() || answer;
      const uses = m.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (m.stop_reason !== "tool_use" || !uses.length) break;
      merged.push({ role: "assistant", content: m.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        let out: string;
        try {
          out = await runTool(member, u.name, (u.input ?? {}) as Record<string, unknown>, jobs, phones, shown);
        } catch (e) {
          out = `That didn't work: ${e instanceof Error ? e.message : String(e)}`;
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: out.slice(0, 16_000) });
      }
      merged.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("sol failed", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}: ${e.message}` : String(e)));
    if (!answer) await giveBackSolCredit(businessId, credit);
    answer = answer || "Something went wrong reaching Claude just then. Try again in a moment.";
  }
  const sol: SolTurn = {
    role: "sol",
    text: answer || (shown.drafts.length ? "Here's the draft." : shown.charts.length || shown.diagrams.length ? "Here it is." : "Done."),
    at: new Date().toISOString(),
    ...(shown.charts.length ? { charts: shown.charts } : {}),
    ...(shown.diagrams.length ? { diagrams: shown.diagrams } : {}),
    ...(shown.drafts.length ? { drafts: shown.drafts } : {}),
    ...(shown.reminder ? { reminder: shown.reminder } : {}),
  };
  return addSolTurns(businessId, email, [you, sol]);
}

/** A time chosen on a reminder card: the reminder is set, and the card on that turn says when. */
export async function chooseReminderTime(member: Member, id: string, choice: WhenChoice): Promise<SolState | null> {
  const at = dueFor(choice);
  if (!at) return null;
  const due = at.toISOString();
  let found = false;
  const state = await withSol(member.businessId, member.email, (row) => {
    found = row.reminders.some((r) => r.id === id && !r.firedAt);
    if (!found) return row;
    return {
      ...row,
      reminders: row.reminders.map((r) => (r.id === id ? { ...r, dueAt: due } : r)),
      turns: row.turns.map((t) => (t.reminder?.id === id ? { ...t, reminder: { ...t.reminder, dueAt: due } } : t)),
    };
  });
  return found ? state : null;
}

/**
 * Sol tagged in a team chat channel (as Primero's Lance): asked as the member who tagged him, so he sees only what they
 * may see, with the channel's last lines for context; his answer is posted in the channel as Sol. The question and
 * answer also land in that member's own conversation with him, where any email he writes waits as a card.
 */
export async function solAnswersInChannel(member: Member, room: string, asked: string, apiKey: string | null): Promise<void> {
  const channel = TEAM_CHANNELS.find((c) => c.id === room);
  if (!channel) return;
  const before = (await channelContext(member.businessId, room)).filter((l) => l.text !== asked);
  const context = before.map((l) => `${nameOf(l.by)}: ${l.text}`).join("\n");
  const prompt =
    `${nameOf(member.email)} tagged you in the team chat's ${channel.label} channel, which everyone in the business reads. ` +
    `Answer them there, briefly, as a teammate would. Never put a customer's phone or email in the channel. ` +
    `The channel shows your charts and diagrams under your words: when a picture shows it more clearly (a battery's clearances, a roof's setbacks, how strings run), draw one, labelled with the figures you give.\n\nTheir message: ${asked}` +
    (context ? `\n\nThe channel's lines before it:\n${context}` : "");
  let said: string;
  let visuals: { charts?: unknown; diagrams?: unknown } = {};
  try {
    const state = await askSol(member, { text: prompt, files: [] }, apiKey, "channel");
    const last = [...state.turns].reverse().find((t) => t.role === "sol");
    said = last?.text?.trim() || "I couldn't answer that just now.";
    // His pictures go into the channel with his words.
    visuals = { charts: last?.charts ?? [], diagrams: last?.diagrams ?? [] };
    if (last?.drafts?.length)
      said += `\n\n(The email I wrote is in ${nameOf(member.email).split(" ")[0]}'s chat with me, to check and send.)`;
  } catch (e) {
    console.error("sol in the team chat failed", e instanceof Error ? e.message : e);
    said = "I couldn't answer that just now. Try me again in a moment.";
  }
  await solSaysInTeam(member.businessId, room, said, visuals);
}
