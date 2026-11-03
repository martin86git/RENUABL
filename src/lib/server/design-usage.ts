/**
 * Server only. Sol looks through a customer's file for what their home uses (1 Nov 2026, Martin, as Primero's): the
 * deal's details, its notes, calls and emails, and the chat with the customer. Only reads, and only finds: a figure he
 * can't quote from the file is never given, and the designer shows the words he found it in to check before saving.
 */
import { FILE_USAGE_PROMPT, FILE_USAGE_SCHEMA, type FileUsageRead } from "@/lib/domain/design/design-bill";
import type { Customer, Job } from "@/lib/domain/design/crm";
import { readWithClaude, type ReadOptions } from "./claude-reader";
import { chatLines } from "./design-chat-repo";
import { customerDetail } from "./design-crm-repo";

const day = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" })
    : "";

/** The customer's file as words: everything a usage figure is likely to be in. */
async function fileText(businessId: string, job: Job, customer: Customer): Promise<string> {
  const [detail, chat] = await Promise.all([customerDetail(businessId, customer.id), chatLines(businessId, job.id).catch(() => [])]);
  const out: string[] = [`DEAL: ${job.title}`];
  const details = Object.entries(job.details ?? {}).filter(([, v]) => typeof v === "string" && v.trim());
  if (details.length) out.push("", "DETAILS ON THE DEAL", ...details.map(([k, v]) => `- ${k}: ${String(v).slice(0, 400)}`));
  for (const a of (detail?.activity ?? []).filter((x) => x.jobId === job.id || x.jobId === null).slice(0, 40))
    out.push("", `${a.kind.toUpperCase()} ${day(a.at)}`, a.text.slice(0, 2500));
  if (chat.length)
    out.push(
      "",
      "CHAT WITH THE CUSTOMER",
      ...chat.slice(-60).map((l) => `${l.from === "customer" ? "Customer" : "Us"} (${day(l.at)}): ${l.text.slice(0, 1200)}`),
    );
  return out.join("\n").slice(0, 60_000);
}

export async function findUsageInFile(
  businessId: string,
  job: Job,
  customer: Customer,
  apiKey: string,
  ai?: ReadOptions,
): Promise<Partial<FileUsageRead>> {
  const text = await fileText(businessId, job, customer);
  return readWithClaude<FileUsageRead>([{ type: "text", text }], FILE_USAGE_SCHEMA, FILE_USAGE_PROMPT, apiKey, ai);
}
