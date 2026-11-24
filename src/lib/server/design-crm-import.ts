/**
 * Contacts and deals brought in from an export sheet (domain/design/crm-import.ts). Each row becomes a customer, found
 * by email and then phone so nobody is made twice or written over, and in deals mode a deal on them. A row is noted in
 * `design_imports` (source `sheet`) so the same sheet brought in twice adds nothing.
 */
import {
  IMPORT_LIMITS,
  dealTitleFor,
  importNote,
  rowRef,
  type ImportMode,
  type ImportOutcome,
  type ImportRow,
} from "@/lib/domain/design/crm-import";
import { INSTALLED_STAGES, WON_STAGES, cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { query, transaction } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { createCustomer, createJob, record } from "./design-crm-repo";

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= query(
    `create table if not exists design_imports (
       business_id text not null references businesses(id) on delete cascade,
       source text not null,
       ref text not null,
       job_id text,
       reference text,
       by_email text not null,
       at timestamptz not null default now(),
       primary key (business_id, source, ref)
     )`,
  ).then(
    () => undefined,
    (e) => {
      ready = null;
      throw e;
    },
  );
  return ready;
}

async function findCustomer(businessId: string, row: ImportRow): Promise<string | null> {
  if (row.email) {
    const byEmail = await query<{ id: string }>(`select id from design_customers where business_id = $1 and lower(email) = $2 limit 1`, [
      businessId,
      row.email,
    ]);
    if (byEmail[0]) return byEmail[0].id;
  }
  const digits = row.phone.replace(/\D/g, "");
  // With an email on the row, a phone alone only finds someone with no email of their own: a shared number isn't the same person.
  if (digits.length >= 8) {
    const byPhone = await query<{ id: string }>(
      `select id from design_customers where business_id = $1 and regexp_replace(phone, '\\D', '', 'g') = $2 and ($3 = '' or coalesce(email, '') = '') limit 1`,
      [businessId, digits, row.email],
    );
    if (byPhone[0]) return byPhone[0].id;
  }
  return null;
}

async function keepRow(
  businessId: string,
  row: ImportRow,
  mode: ImportMode,
  sheet: string,
  by: string,
  fields: ReturnType<typeof typedFields>,
): Promise<ImportOutcome> {
  const ref = rowRef(row, mode);
  const done = await query(`select 1 from design_imports where business_id = $1 and source = 'sheet' and ref = $2`, [businessId, ref]);
  if (done.length) return { result: "already" };

  const person = {
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    address: row.address,
    source: row.source || "Import",
  };
  let customerIn = cleanCustomerInput({ ...person, email: row.email, lat: null, lng: null, notes: "" });
  // An email or phone the CRM won't take doesn't lose the person: they come without it.
  if (!customerIn.ok) customerIn = cleanCustomerInput({ ...person, email: "", phone: "", lat: null, lng: null, notes: "" });
  if (!customerIn.ok) return { result: "failed", why: customerIn.message };

  const details: Record<string, string> = {};
  if (row.kw) {
    details.systemType = "Solar";
    details.systemSize = `${row.kw} kW`;
  }
  const jobIn =
    mode === "deals"
      ? cleanJobInput(
          { title: dealTitleFor(row), address: row.address, stage: row.stage, value: row.value, kw: row.kw, details },
          undefined,
          fields,
        )
      : null;
  if (jobIn && !jobIn.ok) return { result: "failed", why: jobIn.message };

  const found = await findCustomer(businessId, row);
  // A contact already here is left exactly as it is.
  if (found && mode === "contacts") {
    await query(`insert into design_imports (business_id, source, ref, by_email) values ($1, 'sheet', $2, $3) on conflict do nothing`, [
      businessId,
      ref,
      by.toLowerCase(),
    ]);
    return { result: "already" };
  }

  let customerId: string;
  let jobId: string | null = null;
  if (found && jobIn?.ok) {
    const made = await createJob(businessId, found, jobIn.value, by);
    if (typeof made === "string")
      return { result: "failed", why: made === "full" ? "That customer has too many jobs." : "The deal couldn't be made." };
    customerId = found;
    jobId = made.id;
  } else {
    const made = await createCustomer(businessId, customerIn.value, jobIn?.ok ? jobIn.value : null, by);
    if (made === "full") return { result: "failed", why: "The CRM is full." };
    customerId = made.customer.id;
    jobId = made.job?.id ?? null;
  }

  const won = (WON_STAGES as readonly string[]).includes(row.stage);
  const installed = (INSTALLED_STAGES as readonly string[]).includes(row.stage);
  await transaction(async (q) => {
    if (jobId)
      await q(
        `update design_jobs set kw = coalesce($3, kw),
                won_at = case when $4::boolean then coalesce(($5::date + time '12:00') at time zone 'Australia/Melbourne', won_at, now()) else won_at end,
                installed_at = case when $6::boolean then coalesce(installed_at, now()) else installed_at end,
                owner_email = coalesce((select e from (select m.email as e from business_members m where m.business_id = $1 union all select o.email from design_owner_only o where o.business_id = $1) x where lower(e) = $7 limit 1), owner_email),
                updated_at = now()
          where business_id = $1 and id = $2`,
        [businessId, jobId, row.kw, won, row.day || null, installed, row.owner],
      );
    await record(q, businessId, { customerId, jobId, kind: "note", text: importNote(row, sheet), by: by.toLowerCase() });
    await q(
      `insert into design_imports (business_id, source, ref, job_id, by_email) values ($1, 'sheet', $2, $3, $4) on conflict do nothing`,
      [businessId, ref, jobId, by.toLowerCase()],
    );
  });
  return { result: "in", deal: Boolean(jobId) };
}

/** A batch of rows from an export sheet (each read again by `cleanImportRow`) kept as customers and, in deals mode, deals. */
export async function bringInSheetRows(
  businessId: string,
  rows: readonly ImportRow[],
  mode: ImportMode,
  sheet: string,
  by: string,
): Promise<ImportOutcome[]> {
  await ensureTable();
  const fields = typedFields((await loadPrefs(businessId)).dealFields);
  const out: ImportOutcome[] = [];
  for (const row of rows.slice(0, IMPORT_LIMITS.batch)) {
    try {
      out.push(await keepRow(businessId, row, mode, sheet, by, fields));
    } catch {
      console.error("[crm-import] a row couldn't be brought in");
      out.push({ result: "failed", why: "Something went wrong bringing this one in." });
    }
  }
  return out;
}
