/**
 * A business's customers, jobs and their history, as the screens ask for
 * them. Everything is kept on the server for the signed-in business
 * (`/api/design/customers`, `/jobs`, `/overview`): there is no on-device
 * version, so these need a signed-in business. Each call answers with what
 * was asked for, or a plain message to show.
 */
import { withFiles } from "./form";
import type { Activity, Customer, Job, JobStage, SavedPipeline } from "@/lib/domain/design/crm";
import { cleanExtras, defaultBill, defaultQuote, postcodeIn, type QuoteFields, type QuoteForm } from "@/lib/domain/design/quote";
import { cleanDesignSet, type RoofDesign } from "@/lib/domain/design/roof-design";

export type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; signedOut?: boolean };

const UNREACHABLE = "We couldn't reach your account just now. Try again in a moment.";

export async function ask<T>(path: string, init?: { method: string; body?: unknown }): Promise<Answer<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      // A form (an email with files) goes as it is, so the browser sets its own multipart header.
      ...(init?.body instanceof FormData
        ? { body: init.body }
        : init?.body !== undefined
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }
          : {}),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE, ...(res.status === 401 ? { signedOut: true } : {}) };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export type CustomerLine = Customer & {
  jobs: number;
  stage: JobStage | null;
  /** A customer (a job installed), not only a contact. */
  installed: boolean;
  has: { solar: boolean; battery: boolean; ev: boolean };
  unsubscribed: boolean;
};
export const groupEmailStatus = () => ask<{ canSend: boolean; replyTo: string }>("/api/design/customers/group-email");
export const sendGroupEmail = (input: { subject: string; body: string; ids: string[] }) =>
  ask<{ sent: number; noEmail: number; unsubscribed: number; over: number; failed: number }>("/api/design/customers/group-email", {
    method: "POST",
    body: input,
  });
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
  /** What the member asking did today, for Today's "Your day so far". */
  mine: Pick<Activity, "kind" | "by">[];
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
  ask<{ activity: Activity; mentioned?: string[] }>(`/api/design/customers/${encodeURIComponent(customerId)}/activity`, {
    method: "POST",
    body: entry,
  });

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
export const loadWeather = () =>
  ask<{ place: string; degrees: number | null; sky: import("@/lib/domain/weather").Sky | null }>("/api/design/weather");

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
export const emailDeal = (jobId: string, email: { to: string; subject: string; body: string }, files: readonly File[] = []) =>
  ask<{ message: string; activity: Activity | null }>(`/api/design/jobs/${encodeURIComponent(jobId)}/email`, {
    method: "POST",
    body: files.length ? withFiles(email, files) : email,
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

/** The business's service cases (Service pipeline), each with its customer and deal. */
export const listService = () => ask<{ cases: import("@/lib/server/design-service-repo").ServiceLine[] }>("/api/design/service");
/** How many service cases are still to resolve, for the nav. */
export const serviceCount = () => ask<{ open: number }>("/api/design/service?count=1");
/** Flags a deal for service. */
export const raiseService = (jobId: string, issue: string) =>
  ask<{ case: import("@/lib/domain/design/service").ServiceCase }>("/api/design/service", { method: "POST", body: { jobId, issue } });
/** Moves a case on, adds a note, or both. */
export const updateService = (id: string, change: { state?: string; text?: string }) =>
  ask<{ case: import("@/lib/domain/design/service").ServiceCase }>(`/api/design/service/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: change,
  });

/** The signed-in member's notifications (their @mentions), newest first, and how many are unread. */
export const loadNotifications = () =>
  ask<{ notifications: import("@/lib/server/design-notifications-repo").Notification[]; unread: number }>("/api/design/notifications");
/** How many of the member's notifications are unread, for the nav. */
export const notificationCount = () => ask<{ unread: number }>("/api/design/notifications?count=1");
/** Marks the member's own notifications read: those named, those on a deal, or all. */
export const markNotificationsRead = (which: { ids?: string[]; jobId?: string; all?: boolean }) =>
  ask<object>("/api/design/notifications", { method: "PUT", body: which });
/** Gives a deal to a member of the business (their email), or to no one (null). */
export const setDealOwner = (jobId: string, owner: string | null) =>
  ask<{ job: Job }>(`/api/design/jobs/${encodeURIComponent(jobId)}`, { method: "PUT", body: { owner } });

/** The business's monthly sales targets (the overview's rings close at them). */
export const loadTargets = () => ask<{ targets: import("@/lib/domain/design/sales-rings").SalesTargets }>("/api/design/targets");
export const saveTargets = (targets: { sales: string; deals: string; kw: string }) =>
  ask<{ targets: import("@/lib/domain/design/sales-rings").SalesTargets }>("/api/design/targets", { method: "PUT", body: { targets } });

export interface MapJob {
  id: string;
  customer: string;
  address: string;
  lat: number;
  lng: number;
  stage: JobStage;
  installDate: string | null;
  kw: number | null;
  installer: string | null;
  wholesalers: string[];
}
/** The job map: sold jobs with places, the base and collection points, and the wholesalers to mark. */
export const loadJobMap = () =>
  ask<{ jobs: MapJob[]; places: import("@/lib/domain/design/job-map").JobPlaces; wholesalers: string[] }>("/api/design/job-map");
export const saveJobPlaces = (places: import("@/lib/domain/design/job-map").JobPlaces) =>
  ask<{ places: import("@/lib/domain/design/job-map").JobPlaces }>("/api/design/job-map", { method: "PUT", body: { places } });
/** The map's picture for a view (fetched by the server in the map's style). */
export const jobMapImage = (v: { lat: number; lng: number; zoom: number }) =>
  `/api/design/job-map/image?lat=${v.lat.toFixed(6)}&lng=${v.lng.toFixed(6)}&zoom=${v.zoom}`;

/** The design tool's home (wave 6): the deals waiting for a design, each deal's first proposal, and the roofs drawn. */
export const loadDesignHome = () => ask<import("@/lib/server/design-home-repo").DesignHomeData>("/api/design/design-home");
/** The roof open in the designer onto a deal, found by where it is. */
export const attachSiteAt = (place: { lat: number; lng: number }, jobId: string) =>
  ask<object>("/api/design/design-home", { method: "POST", body: { ...place, jobId } });
export const attachSite = (projectId: string, jobId: string) =>
  ask<object>("/api/design/design-home", { method: "POST", body: { projectId, jobId } });
/** Sold jobs at the approval gates (Procurement → Pre-approvals, Solar Victoria, Book an installation). */
export const loadApprovals = () =>
  ask<{ counts: Record<import("@/lib/domain/design/approvals").Gate, number>; jobs: JobLine[] }>("/api/design/approvals");
export const approvalCounts = () =>
  ask<{ counts: Record<import("@/lib/domain/design/approvals").Gate, number> }>("/api/design/approvals?count=1");
/** A deal's proposal timeline, newest first. */
export const loadTimeline = (jobId: string) =>
  ask<{ events: import("@/lib/domain/design/timeline").TimelineEvent[] }>(`/api/design/jobs/${encodeURIComponent(jobId)}/timeline`);

/** Updates (wave 7): how many came in since this member last opened them, and marking them opened. */
export const updatesUnseen = () => ask<{ unseen: number }>("/api/design/updates");
export const updatesOpened = () => ask<{ unseen: number }>("/api/design/updates", { method: "POST" });
/** Feedback (wave 7): the business's items, and adding, commenting, ticking off and removing. */
type FeedbackAnswer = { items: import("@/lib/domain/design/feedback").FeedbackItem[]; owner: boolean };
export const loadFeedback = () => ask<FeedbackAnswer>("/api/design/feedback");
export const feedbackAction = (body: Record<string, unknown>) => ask<FeedbackAnswer>("/api/design/feedback", { method: "POST", body });

/** The call note-taker (wave 7): what was heard of a call on a deal, written up by Claude; nothing heard is kept. */
export const writeUpCall = (jobId: string, lines: import("@/lib/domain/design/call-notes").HeardLine[]) =>
  ask<{
    notes: import("@/lib/domain/design/call-notes").CallNotes;
    text: string;
    changes: import("@/lib/domain/design/prepared").DetailChange[];
  }>(`/api/design/jobs/${encodeURIComponent(jobId)}/call-notes`, { method: "POST", body: { lines } });
/** A service case at a glance: what the customer said, what the team has done, and Sol's issue, solution and what it waits on. */
export const serviceBrief = (id: string) =>
  ask<import("@/lib/domain/design/service-brief").CaseBrief>(`/api/design/service/${encodeURIComponent(id)}/brief`);
