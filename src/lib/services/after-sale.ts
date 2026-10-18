/**
 * What happens after a sale, as the screens ask for it: the proposals sent
 * and signed, the Ordering Station, Installer Invoices, the Install Scheduler
 * and the business's after-sale settings. Kept on the server for the
 * signed-in business; each call answers with what was asked for or a plain
 * message to show.
 */
import type { InstallCost, InstallerInvoice } from "@/lib/domain/design/installer-invoices";
import type { OrderState } from "@/lib/domain/design/orders";
import type { BusinessPrefs } from "@/lib/domain/design/prefs";
import type { BookedJob, InvoicesView, JobOrder, OrderRow, ProposalLine } from "@/lib/server/design-after-sale-repo";
import { ask, type Answer } from "./crm";

export type { BookedJob, InvoicesView, JobOrder, OrderRow, ProposalLine };

export const loadPrefs = () => ask<{ prefs: BusinessPrefs }>("/api/design/prefs");
export const savePrefs = (prefs: BusinessPrefs) => ask<{ prefs: BusinessPrefs }>("/api/design/prefs", { method: "PUT", body: { prefs } });

export const listProposals = () => ask<{ proposals: ProposalLine[] }>("/api/design/proposals");
/** A proposal's follow-up done: the follow-up day it fell due on, called or emailed. */
export const markFollowUp = (jobId: string, day: number, how: "call" | "email") =>
  ask<object>(`/api/design/jobs/${encodeURIComponent(jobId)}/follow-up`, { method: "POST", body: { day, how } });

export const listOrders = () => ask<{ orders: OrderRow[] }>("/api/design/orders");
export const loadOrder = (jobId: string) => ask<{ order: JobOrder }>(`/api/design/orders/${encodeURIComponent(jobId)}`);
export const saveOrder = (jobId: string, order: OrderState) =>
  ask<{ order: JobOrder }>(`/api/design/orders/${encodeURIComponent(jobId)}`, { method: "PUT", body: { order } });
export const emailOrder = (jobId: string, input: { list: string | null; to: string; intro: string }) =>
  ask<{ message: string }>(`/api/design/orders/${encodeURIComponent(jobId)}/email`, { method: "POST", body: input });

export const loadInvoices = () => ask<InvoicesView>("/api/design/invoices");
export type InvoiceFigures = Pick<InstallerInvoice, "installer" | "number" | "date" | "subTotal" | "gst" | "lines">;
export const addInvoice = (input: { jobId: string | null; figures: InvoiceFigures; fileName: string }) =>
  ask<{ invoice: InstallerInvoice }>("/api/design/invoices", { method: "POST", body: input });
export const workOutAgain = (jobId: string) =>
  ask<{ cost: InstallCost }>("/api/design/invoices", { method: "POST", body: { jobId, again: true } });
export const assignInvoice = (id: string, jobId: string | null) =>
  ask<object>(`/api/design/invoices/${encodeURIComponent(id)}`, { method: "PATCH", body: { jobId } });
export const deleteInvoice = (id: string) => ask<object>(`/api/design/invoices/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Reads an installer's invoice file for its figures; nothing is kept until they are confirmed. */
export async function readInvoice(file: File): Promise<Answer<{ figures: InvoiceFigures; reference: string; complete: boolean }>> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/design/invoices/read", { method: "POST", body: form });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; message?: string } & Record<string, unknown>) | null;
    if (res.ok && json?.ok) return json as { ok: true; figures: InvoiceFigures; reference: string; complete: boolean };
    return { ok: false, message: json?.message ?? "That invoice couldn't be read just now." };
  } catch {
    return { ok: false, message: "That invoice couldn't be read just now." };
  }
}

export const loadSchedule = (from: string, to: string) =>
  ask<{ jobs: BookedJob[] }>(`/api/design/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export type { InstallExtra } from "@/lib/server/design-after-sale-repo";
export const loadInstallExtras = () =>
  ask<{ extras: import("@/lib/server/design-after-sale-repo").InstallExtra[] }>("/api/design/installs");

export type { InstallEvent } from "@/lib/domain/design/install-event";
/** One booked installation as a calendar event, with its job sheet. */
export const loadInstallEvent = (jobId: string) =>
  ask<{ event: import("@/lib/domain/design/install-event").InstallEvent; customer: { name: string; phone: string } }>(
    `/api/design/schedule/${encodeURIComponent(jobId)}`,
  );
