/**
 * A business's customers, jobs and their history, as the screens ask for
 * them. Everything is kept on the server for the signed-in business
 * (`/api/design/customers`, `/jobs`, `/overview`): there is no on-device
 * version, so these need a signed-in business. Each call answers with what
 * was asked for, or a plain message to show.
 */
import type { Activity, Customer, Job, JobStage } from "@/lib/domain/design/crm";

export type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; signedOut?: boolean };

const UNREACHABLE = "We couldn't reach your account just now. Try again in a moment.";

async function ask<T>(path: string, init?: { method: string; body?: unknown }): Promise<Answer<T>> {
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
export const createCustomer = (input: CustomerInput) =>
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
export const saveJob = (id: string, patch: Partial<Pick<Job, "title" | "address" | "lat" | "lng" | "stage" | "value" | "installDate">>) =>
  ask<{ job: Job }>(`/api/design/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: patch });
export const deleteJob = (id: string) => ask<object>(`/api/design/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });

export const loadOverview = () => ask<Overview>("/api/design/overview");

/** "$12,400", or a dash when there is no figure yet. */
export const dollars = (n: number | null | undefined) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-AU")}` : "–");

/** "10 Oct 2026" from a date or a date and time. */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};
