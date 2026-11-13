/**
 * Server only. A written chat with the team's own assistant, its chief of staff (domain/design/colleague-chat.ts): Claude
 * with the same reading-only tools a call has (`colleagueTool`), every deal read as the signed-in member may see it.
 * Nothing is kept on the server: the conversation is the member's own, held in their browser. Only where the chief of
 * staff is on for the business (`colleagueReady`), and RENUABL pays for the answers (no Sol credit).
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  CHAT_COPY,
  CHAT_STEPS,
  COLLEAGUE_CHAT_TOOLS,
  COLLEAGUE_REPLY,
  COLLEAGUE_REPLY_TOOL,
  cleanChatAnswer,
  shortSay,
  chatMessages,
  colleagueChatPrompt,
  type ChatCard,
  type ChatLine,
} from "@/lib/domain/design/colleague-chat";
import { COLLEAGUE_TOOLS } from "@/lib/domain/design/colleague";
import { todayInMarket } from "@/lib/domain/market";
import { parseApiKey } from "./bill-reader";
import { colleagueOnCall, colleagueReady, colleagueTool } from "./design-colleague";
import type { Member } from "./design-repo";

const CHAT_MODEL = "claude-sonnet-5-5";

type CallRow = Parameters<typeof colleagueTool>[0];

/** Whether a chat can be had: the chief of staff is on for the business and Claude is set up. */
export async function colleagueChatOn(businessId: string): Promise<boolean> {
  if (!parseApiKey(process.env.ANTHROPIC_API_KEY)) return false;
  return (await colleagueReady(businessId)).on;
}

/** The member's question answered, from their deals only. */
export async function chatWithColleague(
  member: Member,
  text: string,
  history: readonly ChatLine[],
): Promise<{ ok: true; text: string; cards: ChatCard[] } | { ok: false; status: number; message: string }> {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return { ok: false, status: 409, message: CHAT_COPY.noClaude };
  if (!(await colleagueReady(member.businessId)).on) return { ok: false, status: 409, message: CHAT_COPY.off };

  // The tools read as a call's do: this stands for a call in the browser by this signed-in member, already through.
  const asCall = {
    id: "chat",
    business_id: member.businessId,
    email: member.email.toLowerCase(),
    channel: "web",
    candidates: null,
    verified: true,
    pin_tries: 0,
    vapi_call_id: null,
    assistant_id: null,
    created_at: new Date(),
    ended_at: null,
  } satisfies CallRow;

  const [settings, facts] = await Promise.all([colleagueOnCall(member.businessId), colleagueTool(asCall, COLLEAGUE_TOOLS.day, {})]);
  const system = colleagueChatPrompt({
    name: settings.name,
    business: member.businessName,
    firstName: member.firstName ?? null,
    facts,
    today: todayInMarket(),
  });
  const client = new Anthropic({ apiKey, timeout: 40_000, maxRetries: 1 });
  const model = process.env.COLLEAGUE_CHAT_MODEL?.trim() || CHAT_MODEL;
  const messages: Anthropic.MessageParam[] = chatMessages(history, text);

  try {
    for (let step = 0; step < CHAT_STEPS; step++) {
      // It answers with its own tool (the words for the chat, and what sits beside them); on the last step that is
      // the only tool it has, so it must answer.
      const last = step === CHAT_STEPS - 1;
      const m = await client.messages.create({
        model,
        max_tokens: 1500,
        system,
        messages,
        tools: last ? [COLLEAGUE_REPLY] : [...COLLEAGUE_CHAT_TOOLS, COLLEAGUE_REPLY],
        ...(last ? { tool_choice: { type: "tool" as const, name: COLLEAGUE_REPLY_TOOL } } : {}),
      });
      const uses = m.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const reply = uses.find((u) => u.name === COLLEAGUE_REPLY_TOOL);
      if (reply) {
        const got = cleanChatAnswer(reply.input);
        return got ? { ok: true, ...got } : { ok: false, status: 502, message: CHAT_COPY.failed };
      }
      if (m.stop_reason !== "tool_use" || !uses.length) {
        // Words with no tool: kept, cut to what the chat holds.
        const said = m.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return said ? { ok: true, text: shortSay(said, 600), cards: [] } : { ok: false, status: 502, message: CHAT_COPY.failed };
      }
      messages.push({ role: "assistant", content: m.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        // The PIN is the phone line's door: never a chat's tool, whatever is asked for.
        const out = u.name === COLLEAGUE_TOOLS.pin ? "That isn't something I can do." : await colleagueTool(asCall, u.name, u.input);
        results.push({ type: "tool_result", tool_use_id: u.id, content: out.slice(0, 16_000) });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("the chief of staff's chat failed", e instanceof Error ? e.message : e);
  }
  return { ok: false, status: 502, message: CHAT_COPY.failed };
}
