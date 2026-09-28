/** The field app's status updates (en route, on site, …). */
import type { FieldStatus } from "@/lib/domain/types";

export async function updateJobStatus(jobId: string, status: FieldStatus, at: string) {
  await new Promise((r) => setTimeout(r, 400));
  return { jobId, status, at, customerNotified: status === "en-route" || status === "on-site" || status === "complete" };
}
