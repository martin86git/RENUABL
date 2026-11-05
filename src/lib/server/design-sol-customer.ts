/**
 * Server only. Sol answering a customer in their proposal's chat (domain/design/sol-customer.ts), run after the
 * customer's message is kept and answered (`customerSays`, through `after`), so the customer is never held up.
 *
 * He is given the customer's own copy of the proposal (`publicProposal`, which holds no cost) and the conversation,
 * and nothing else of the business's. He answers only when the business has him switched on and the team hasn't
 * taken the conversation over (`solMayAnswer`), and an answer that comes too late (someone from the team wrote while
 * he was thinking) is dropped. Nothing is emailed: the customer is on the page, and the business is already told of
 * every message its customer writes.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SOL_HANDED_OVER, solReplied } from "@/lib/domain/design/chat";
import { readSolReply, solCustomerSystem, solDraftAsk, solDraftSystem, solHistory, solMayAnswer } from "@/lib/domain/design/sol-customer";
import { todayInMarket } from "@/lib/domain/market";
import { redactSecrets } from "./bill-reader";
import { transaction } from "./db";
import { addSolLine, chatLines } from "./design-chat-repo";
import { record } from "./design-crm-repo";
import { giveBackSolCredit, keepCost, modelFor, takeSolCredit, withSolCredit } from "./sol-credits";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { TIER_CREDITS, USE_TIER } from "@/lib/domain/design/sol-routing";
import { usageOf } from "@/lib/domain/ai-costs";
import { loadBrand, proposalJob, publicProposal, tokenForJob } from "./design-proposal-repo";

/** A customer reads every word: always the deeper model (sol-routing.ts). */
const TIER = USE_TIER.customer;
/** Who an answer of Sol's is from on the customer's record. */
const BY_SOL = "Sol";

/** Whether Sol answers this business's customers at all: its setting, and Claude set up here. */
export async function solAnswersFor(businessId: string, businessName: string): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return false;
  return (await loadBrand(businessId, businessName)).solAnswers;
}

/**
 * A reply Sol writes for a member to send in a deal's chat (`solDraftSystem`): from the customer's own copy of the
 * proposal and the conversation, never a cost. One Sol credit of the customer chat's deep tier, given back when no
 * answer comes. Nothing is kept or sent: the member changes it and sends it as their own reply.
 */
export async function solDraftsReply(
  businessId: string,
  jobId: string,
  ask: string,
  by: string,
): Promise<{ text: string } | { problem: string; status: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { problem: "Sol isn't set up on this site yet, so he can't write a reply.", status: 503 };
  const token = await tokenForJob(businessId, jobId);
  const proposal = token ? await publicProposal(token, todayInMarket()) : null;
  if (!proposal?.view)
    return {
      problem: "Sol writes from the customer's proposal, and this deal has none out yet. Publish it first, or write the reply yourself.",
      status: 409,
    };
  const view = proposal.view;
  const lines = await chatLines(businessId, jobId);
  try {
    const raw = await withSolCredit(
      businessId,
      "customer",
      by,
      async (ai) => {
        const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
        const m = await client.messages.create({
          model: ai.model,
          max_tokens: 700,
          system: solDraftSystem(view),
          messages: [{ role: "user", content: solDraftAsk(lines, ask, view.customer.name.split(/\s+/)[0] || "Customer") }],
        });
        ai.onUsage(usageOf(m.model, m.usage));
        return m.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
      },
      TIER,
      "chat reply drafted",
    );
    if (raw === "out") return { problem: SOL_OUT_SHORT, status: 402 };
    const reply = readSolReply(raw);
    return reply ? { text: reply.text } : { problem: "Sol couldn't write that one. Try putting it another way.", status: 502 };
  } catch (e) {
    console.error("sol couldn't draft a chat reply", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}` : String(e)));
    return { problem: "Sol couldn't write a reply just now. Try again in a moment.", status: 502 };
  }
}

/** Sol's answer to the customer behind a link, when he may give one. Every failure stops quietly: the team still has the message. */
export async function solAnswersCustomer(token: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return;
  const found = await proposalJob(token);
  if (!found || found.withdrawn) return;
  if (!(await loadBrand(found.businessId, found.businessName)).solAnswers) return;
  const lines = await chatLines(found.businessId, found.jobId);
  if (!solMayAnswer({ on: true, lines, now: new Date() })) return;
  const proposal = await publicProposal(token, todayInMarket());
  if (!proposal?.view) return;
  const asked = lines[lines.length - 1];
  const credit = await takeSolCredit(found.businessId, "customer", null, TIER_CREDITS[TIER]);
  if (!credit) return;

  let raw = "";
  try {
    const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
    const m = await client.messages.create({
      model: modelFor(TIER),
      max_tokens: 700,
      system: solCustomerSystem(proposal.view),
      messages: solHistory(lines),
    });
    raw = m.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    await keepCost(found.businessId, credit, TIER, "customer chat", [usageOf(m.model, m.usage)]);
  } catch (e) {
    console.error("sol couldn't answer a customer", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}` : String(e)));
    await giveBackSolCredit(found.businessId, credit);
    return;
  }
  const reply = readSolReply(raw);
  if (!reply) return;
  const kept = await addSolLine(found.businessId, found.jobId, reply.text, asked.at);
  if (!kept) return;
  await transaction(async (q) => {
    const line = { customerId: found.customerId, jobId: found.jobId, kind: "message" as const, by: BY_SOL };
    await record(q, found.businessId, { ...line, text: solReplied(reply.text) });
    if (reply.handover) await record(q, found.businessId, { ...line, text: SOL_HANDED_OVER });
  }).catch(() => console.error("sol's answer was kept, but writing it on the record failed"));
}
