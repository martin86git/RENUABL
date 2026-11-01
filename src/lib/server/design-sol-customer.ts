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
import { readSolReply, solCustomerSystem, solHistory, solMayAnswer } from "@/lib/domain/design/sol-customer";
import { todayInMarket } from "@/lib/domain/market";
import { redactSecrets } from "./bill-reader";
import { transaction } from "./db";
import { addSolLine, chatLines } from "./design-chat-repo";
import { record } from "./design-crm-repo";
import { loadBrand, proposalJob, publicProposal } from "./design-proposal-repo";

const MODEL = () => process.env.SOL_MODEL?.trim() || "claude-opus-5-5";
/** Who an answer of Sol's is from on the customer's record. */
const BY_SOL = "Sol";

/** Whether Sol answers this business's customers at all: its setting, and Claude set up here. */
export async function solAnswersFor(businessId: string, businessName: string): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return false;
  return (await loadBrand(businessId, businessName)).solAnswers;
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

  let raw = "";
  try {
    const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
    const m = await client.messages.create({
      model: MODEL(),
      max_tokens: 700,
      system: solCustomerSystem(proposal.view),
      messages: solHistory(lines),
    });
    raw = m.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (e) {
    console.error("sol couldn't answer a customer", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}` : String(e)));
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
