/**
 * A business's customers, jobs and their history, as the screens ask for
 * them. Everything is kept on the server for the signed-in business
 * (`/api/design/customers`, `/jobs`, `/overview`): there is no on-device
 * version, so these need a signed-in business. Each call answers with what
 * was asked for, or a plain message to show.
 */
import type { Activity, Customer, Job, JobStage, SavedPipeline } from "@/lib/domain/design/crm";
import { cleanExtras, defaultBill, defaultQuote, postcodeIn, type QuoteFields, type QuoteForm } from "@/lib/domain/design/quote";
import { cleanDesignSet, type RoofDesign } from "@/lib/domain/design/roof-design";

export type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; signedOut?: boolean };

const UNREACHABLE = "We couldn't reach your account just now. Try again in a moment.";

export async function ask<T>(path: string, init?: { method: string; body?: unknown }): Promise<Answer<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      ...(init?.body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE, ...(res.status === 401 ? { signedOut: true } : {}) };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export type CustomerLine = Customer & { jobs: number; stage: JobStage | null };
export type JobLine = Job & { customerName: string };
export type ActivityLine = Activity & { customerName: string };

export interface CustomerInput {
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email: string;
  address: string;
  lat: number | null;
  lng: number | null;
  source: string;
  notes: string;
}

export interface Overview {
  counts: Record<JobStage, number>;
  openValue: number;
  wonValue: number;
  customers: number;
  recent: ActivityLine[];
}

export const listCustomers = () => ask<{ customers: CustomerLine[] }>("/api/design/customers");
/** A new customer. `deal: false` adds them alone, without the first job an address otherwise starts. */
export const createCustomer = (input: CustomerInput & { deal?: boolean }) =>
  ask<{ customer: Customer; job: Job | null }>("/api/design/customers", { method: "POST", body: input });
export const loadCustomer = (id: string) =>
  ask<{ customer: Customer; jobs: Job[]; activity: Activity[] }>(`/api/design/customers/${encodeURIComponent(id)}`);
export const saveCustomer = (id: string, input: CustomerInput) =>
  ask<{ customer: Customer }>(`/api/design/customers/${encodeURIComponent(id)}`, { method: "PUT", body: input });
export const deleteCustomer = (id: string) => ask<object>(`/api/design/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
export const addActivity = (customerId: string, entry: { kind: "note" | "call" | "email"; text: string; jobId?: string }) =>
  ask<{ activity: Activity }>(`/api/design/customers/${encodeURIComponent(customerId)}/activity`, { method: "POST", body: entry });

export const listJobs = () => ask<{ jobs: JobLine[] }>("/api/design/jobs");
export const createJob = (input: { customerId: string; title: string; address: string; lat: number | null; lng: number | null }) =>
  ask<{ job: Job }>("/api/design/jobs", { method: "POST", body: input });
export const loadJob = (id: string) => ask<{ job: Job; customer: Customer }>(`/api/design/jobs/${encodeURIComponent(id)}`);
export const saveJob = (
  id: string,
  patch: Partial<Pick<Job, "title" | "address" | "lat" | "lng" | "stage" | "value" | "installDate" | "details" | "kw">>,
) => ask<{ job: Job }>(`/api/design/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: patch });
export const deleteJob = (id: string) => ask<object>(`/api/design/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });

/** The pipelines the business has saved: shared by everyone in it. */
export const listPipelines = () => ask<{ pipelines: SavedPipeline[] }>("/api/design/pipelines");
export const createPipeline = (input: { name: string; stages: JobStage[] }) =>
  ask<{ pipeline: SavedPipeline }>("/api/design/pipelines", { method: "POST", body: input });
export const savePipeline = (id: string, input: { name: string; stages: JobStage[] }) =>
  ask<{ pipeline: SavedPipeline }>(`/api/design/pipelines/${encodeURIComponent(id)}`, { method: "PUT", body: input });
export const deletePipeline = (id: string) => ask<object>(`/api/design/pipelines/${encodeURIComponent(id)}`, { method: "DELETE" });

/** The temperature now, and where it is for. `degrees` is null when it can't be had. */
export const loadWeather = () => ask<{ place: string; degrees: number | null }>("/api/design/weather");

export const loadOverview = () => ask<Overview>("/api/design/overview");

/** "$12,400", or a dash when there is no figure yet. */
export const dollars = (n: number | null | undefined) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-AU")}` : "–");

/** "10 Oct 2026" from a date or a date and time. */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * The design a job is for, as its deal page reads it: the roof's primary
 * design and that design's quote settings (roof, storeys, phase). Null when
 * it can't be fetched or read: the deal then shows its details as not yet known.
 */
export async function loadDealDesign(
  projectId: string,
): Promise<{ design: RoofDesign; form: QuoteForm; edits: QuoteFields["edits"] } | null> {
  const res = await ask<{ project: { design: unknown; extras: unknown; address: string } }>(
    `/api/design/projects/${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) return null;
  const set = cleanDesignSet(res.project.design);
  if (!set) return null;
  const extras = cleanExtras(res.project.extras, set.designs.length, {
    bill: defaultBill({ rate: 0, feedIn: 0, supplyPerDay: 0 }),
    postcode: postcodeIn(res.project.address),
  });
  const quote = extras.quotes[set.primary] ?? defaultQuote("");
  return { design: set.designs[set.primary], form: quote.form, edits: quote.edits };
}

/** Whether a deal's customer can be emailed from here (an email service is set up), and where replies go. */
export const dealEmailStatus = (jobId: string) =>
  ask<{ canSend: boolean; replyTo: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/email`);
/** Emails a deal's customer: sent in the business's name, replies to the member, written on the deal's record. */
export const emailDeal = (jobId: string, email: { to: string; subject: string; body: string }) =>
  ask<{ message: string; activity: Activity | null }>(`/api/design/jobs/${encodeURIComponent(jobId)}/email`, {
    method: "POST",
    body: email,
  });

/** The business's arrangement of a deal's fields (Settings → Deal fields), and whether it is its own. */
export const loadDealFields = () =>
  ask<{ fields: import("@/lib/domain/design/deal-sections").DealFieldsConfig; own: boolean }>("/api/design/deal-fields");
/** Keeps the arrangement (null: back to ours). */
export const saveDealFields = (fields: import("@/lib/domain/design/deal-sections").DealFieldsConfig | null) =>
  ask<{ fields: import("@/lib/domain/design/deal-sections").DealFieldsConfig; own: boolean }>("/api/design/deal-fields", {
    method: "PUT",
    body: { fields },
  });
