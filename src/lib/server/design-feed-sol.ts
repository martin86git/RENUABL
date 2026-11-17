/**
 * Server only. Sol's answer under a question asked of the industry (17 Nov 2026, domain/design/feed-social.ts): after a
 * business posts a question, Sol answers it from a short web search, as one quick Sol answer paid from the asking
 * business's credits (none left: no answer). Only pages his search really showed are kept as sources; the answer is
 * shown under the question as his, to be checked, and its writer is told.
 */
import Anthropic from "@anthropic-ai/sdk";
import { cleanSolAnswer, questionPrompt, readAnswerJson } from "@/lib/domain/design/feed-social";
import { BLOCKED_SITES, SEARCH_FROM, hostOf } from "@/lib/domain/design/sol-knowledge";
import { todayInMarket } from "@/lib/domain/market";
import { usageOf } from "@/lib/domain/ai-costs";
import { setSolAnswer } from "./design-feed-posts-repo";
import type { Member } from "./design-repo";
import { pagesIn } from "./industry-news";
import { withSolCredit } from "./sol-credits";

const TOOLS: Anthropic.ToolUnion[] = [
  { type: "web_search_20250305", name: "web_search", max_uses: 3, blocked_domains: [...BLOCKED_SITES], user_location: SEARCH_FROM },
];

/** Sol answers a question posted to the feed; answers whether an answer was kept. */
export async function answerQuestion(postId: string, m: Member, question: string): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || !question.trim()) return false;
  const out = await withSolCredit(
    m.businessId,
    "channel",
    m.email,
    async (ai) => {
      const client = new Anthropic({ apiKey, maxRetries: 1 });
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: questionPrompt(question, todayInMarket()) }];
      const seen: string[] = [];
      let text = "";
      for (let turn = 0; turn < 3; turn++) {
        const r = await client.messages.create({ model: ai.model, max_tokens: 2000, tools: TOOLS, messages }, { timeout: 90_000 });
        ai.onUsage(usageOf(r.model, r.usage));
        seen.push(...pagesIn(r.content));
        text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
        if (r.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: r.content });
      }
      return cleanSolAnswer(readAnswerJson(text), seen, hostOf);
    },
    "quick",
    "feed-question",
  );
  if (out === "out" || !out) return false;
  await setSolAnswer(postId, out);
  return true;
}
