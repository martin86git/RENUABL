/**
 * Options a customer likes on their proposal (26 Nov 2026, Martin): kept a proposal by its token, business id first,
 * and written on the deal the first time each option is liked. Made by the file itself.
 */
import { likeRecordLine } from "@/lib/domain/design/proposal-reveal";
import { FROM_CUSTOMER } from "@/lib/domain/design/proposal";
import { query, transaction } from "./db";
import { record } from "./design-crm-repo";
import { proposalJob } from "./design-proposal-repo";

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= query(`create table if not exists design_proposal_likes (
  business_id text not null references businesses(id) on delete cascade,
  token text not null,
  option text not null,
  liked boolean not null default true,
  liked_at timestamptz not null default now(),
  noted boolean not null default false,
  primary key (business_id, token, option)
)`).catch((e) => {
    ready = null;
    throw e;
  }));

/** The options liked on a proposal behind a link. */
export async function likesOf(token: string): Promise<string[]> {
  const job = await proposalJob(token).catch(() => null);
  if (!job) return [];
  await table();
  const rows = await query<{ option: string }>(
    `select option from design_proposal_likes where business_id = $1 and token = $2 and liked order by liked_at`,
    [job.businessId, token],
  );
  return rows.map((r) => r.option);
}

/**
 * Likes or unlikes an option. Only an option the proposal really offers; written on the deal the first time it is
 * liked, never again for that option (a like taken back and given again says nothing more). Null for no such link.
 */
export async function setLike(
  token: string,
  option: string,
  liked: boolean,
  offered: (option: string) => string | null,
): Promise<string[] | null> {
  const job = await proposalJob(token).catch(() => null);
  if (!job || job.withdrawn) return null;
  const name = offered(option);
  if (!name) return likesOf(token);
  await table();
  await transaction(async (q) => {
    if (!liked) {
      await q(`update design_proposal_likes set liked = false where business_id = $1 and token = $2 and option = $3`, [
        job.businessId,
        token,
        option,
      ]);
      return;
    }
    const rows = await q<{ noted: boolean }>(
      `insert into design_proposal_likes (business_id, token, option) values ($1, $2, $3)
       on conflict (business_id, token, option) do update set liked = true
       returning noted`,
      [job.businessId, token, option],
    );
    if (rows[0] && !rows[0].noted) {
      await record(q, job.businessId, {
        customerId: job.customerId,
        jobId: job.jobId,
        kind: "proposal",
        text: likeRecordLine(name),
        by: FROM_CUSTOMER,
      });
      await q(`update design_proposal_likes set noted = true where business_id = $1 and token = $2 and option = $3`, [
        job.businessId,
        token,
        option,
      ]);
    }
  });
  return likesOf(token);
}
