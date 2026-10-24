import { cleanAskInput } from "@/lib/domain/ask-knowledge";
import { canvasFacts, canvasSystemPrompt, guessCanvas, readCanvasAnswer } from "@/lib/domain/design/canvas";
import { todayInMarket } from "@/lib/domain/market";
import { AskError, answerWithClaude } from "@/lib/server/ask-claude";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { listJobs } from "@/lib/server/design-crm-repo";
import { casesToResolve } from "@/lib/server/design-service-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { question, history } → { reply, show }: the overview's canvas answering a question about the business. The
 * answer is Claude's, from the business's own jobs as this member may see them (`canvasFacts`: no emails, phones or
 * addresses); `show` names the panels to draw under it. Without a Claude key, or when Claude fails, the question's
 * words pick the panel (`guessCanvas`).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const input = cleanAskInput(read.body);
    if (!input) return Response.json({ ok: false, message: "Ask a question." }, { status: 422 });

    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey || !allow(request, "design-canvas", 120)) return Response.json({ ok: true, ...guessCanvas(input.question) });

    const { businessId } = who.member;
    const [jobs, serviceOpen] = await Promise.all([listJobs(businessId, viewerOf(who.member)), casesToResolve(businessId)]);
    const system = canvasSystemPrompt(who.member.businessName, canvasFacts(jobs, serviceOpen, todayInMarket()));
    try {
      const said = readCanvasAnswer(await answerWithClaude({ system, ...input }, apiKey));
      return Response.json({ ok: true, ...(said.reply ? said : guessCanvas(input.question)) });
    } catch (e) {
      console.error("canvas failed", redactSecrets(e instanceof AskError ? e.message : String(e)));
      return Response.json({ ok: true, ...guessCanvas(input.question) });
    }
  });
}
