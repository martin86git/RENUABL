/** Server only. The signed-in customer's own reservations, for My RENUABL. */
import type { JobStatus } from "@/lib/domain/jobs";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured, query } from "@/lib/server/db";
import { jobsForCustomer } from "@/lib/server/jobs-repo";

/** What the customer sees for each stage (they're "installation partners", never "installers"). */
export const CUSTOMER_STATUS: Record<JobStatus, string> = {
  unassigned: "Matching your installation partner",
  offered: "Matching your installation partner",
  accepted: "Your installation partner has accepted your job",
  scheduled: "Your installation date is confirmed",
  "in-progress": "Installation under way",
  completed: "Installed",
  cancelled: "Cancelled",
};

export async function getMyReservations() {
  if (!dbConfigured()) return null;
  const session = await currentSession();
  if (session?.role !== "customer") return null;
  const jobs = await jobsForCustomer(session.email);
  const partnerIds = [...new Set(jobs.map((j) => j.partnerId).filter((id): id is string => Boolean(id)))];
  const names = partnerIds.length
    ? new Map(
        (await query<{ id: string; business_name: string }>(`select id, business_name from partners where id = any($1)`, [partnerIds])).map(
          (r) => [r.id, r.business_name],
        ),
      )
    : new Map<string, string>();
  return {
    email: session.email,
    reservations: jobs.map((j) => ({
      reference: j.reference,
      packageName: j.packageName,
      installDate: j.installDate,
      status: CUSTOMER_STATUS[j.status],
      partner: j.partnerId ? (names.get(j.partnerId) ?? null) : null,
      recordKey: j.recordKey,
    })),
  };
}
