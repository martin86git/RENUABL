/**
 * Server only. Sol checks a job card's photos (domain/design/photo-check.ts): the newest photos on the card, read with
 * Claude against the design and the as-built record, and one note written on the card's thread as Sol. On demand by
 * the team, and by itself after the installer posts photos on install day.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  PHOTO_CHECK_BY,
  PHOTO_CHECK_MAX,
  PHOTO_CHECK_SCHEMA,
  autoCheckDue,
  cleanFindings,
  photoCheckNote,
  photoCheckPrompt,
  stillToRecord,
} from "@/lib/domain/design/photo-check";
import { todayInMarket } from "@/lib/domain/market";
import { addDaysISO } from "@/lib/domain/scheduling";
import { readWithClaude } from "./claude-reader";
import { addJobNote, jobCard, jobFile } from "./design-job-card-repo";
import { withSolCredit } from "./sol-credits";

const PICTURES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type PhotoCheckOutcome = { ok: true } | { ok: false; message: string; status: number };

/** Checks the card's newest photos and writes Sol's note on its thread. `by` is the member who asked, or null when automatic. */
export async function checkJobPhotos(
  business: { businessId: string; businessName: string },
  jobId: string,
  apiKey: string | null,
  by: string | null,
): Promise<PhotoCheckOutcome> {
  if (!apiKey) return { ok: false, message: "Sol can't check photos just now: Claude isn't set up on this site.", status: 503 };
  const card = await jobCard(business, jobId, true);
  if (!card) return { ok: false, message: "There's no such job.", status: 404 };
  const photos = card.notes.flatMap((n) => n.files.filter((f) => PICTURES.has(f.type))).slice(0, PHOTO_CHECK_MAX);
  if (!photos.length) return { ok: false, message: "There are no photos on this job card yet.", status: 422 };
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  // Kept well under the API's request size: the newest photos first, until about 15 MB.
  let bytes = 0;
  for (const p of photos) {
    const file = await jobFile(business.businessId, jobId, p.id);
    if (!file) continue;
    if (bytes + file.bytes.length > 15_000_000) break;
    bytes += file.bytes.length;
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: file.bytes.toString("base64"),
      },
    });
  }
  if (!blocks.length) return { ok: false, message: "Those photos couldn't be read.", status: 422 };
  const toRecord = stillToRecord(card.asBuilt, card.designed);
  const prompt = photoCheckPrompt({
    details: card.details,
    designed: card.designed,
    toRecord,
    photos: blocks.length,
  });
  let reading: Record<string, unknown> | "out";
  try {
    // Photos to read against the design: the deeper model (sol-routing.ts).
    reading = await withSolCredit(
      business.businessId,
      "chat",
      by,
      (ai) => readWithClaude<Record<string, unknown>>(blocks, PHOTO_CHECK_SCHEMA, prompt, apiKey, ai),
      "deep",
      "photo check",
    );
  } catch (e) {
    console.error("sol's photo check", e instanceof Error ? e.message : e);
    return { ok: false, message: "Sol couldn't look at the photos just now. Try again in a moment.", status: 502 };
  }
  if (reading === "out") return { ok: false, message: "No Sol credits left this month.", status: 402 };
  const note = photoCheckNote(cleanFindings(reading), blocks.length, toRecord);
  const made = await addJobNote(business.businessId, jobId, { side: "team", by: PHOTO_CHECK_BY, byEmail: null, text: note, files: [] });
  return made ? { ok: true } : { ok: false, message: "There's no such job.", status: 404 };
}

/** After the installer posts photos: Sol checks them by himself on install day, at most every half hour a job. */
export async function checkAfterInstallerPhotos(
  business: { businessId: string; businessName: string },
  jobId: string,
  apiKey: string | null,
) {
  if (!apiKey) return;
  const card = await jobCard(business, jobId, true);
  if (!card) return;
  const today = todayInMarket();
  const lastCheck = card.notes.find((n) => n.side === "team" && n.by === PHOTO_CHECK_BY)?.at ?? null;
  if (!autoCheckDue({ installDate: card.job.installDate, today, yesterday: addDaysISO(today, -1), lastCheck, now: new Date() })) return;
  await checkJobPhotos(business, jobId, apiKey, null);
}
