/** The staff marketing pages' calls to the server (contacts, lists, imports). */
import type { ColumnMap, ConsentKind, MarketingContact, MarketingList } from "@/lib/domain/marketing/contacts";
import type { EdmBrand, EdmContent } from "@/lib/domain/marketing/edm";
import type { CampaignState, SendCounts, SequenceDraft, StopReason } from "@/lib/domain/marketing/sequences";

export interface ContactCounts {
  total: number;
  emailable: number;
  unknown: number;
  unsubscribed: number;
  bounced: number;
}

export interface ContactsView {
  contacts: MarketingContact[];
  total: number;
  counts: ContactCounts;
  lists: MarketingList[];
}

export interface CheckedSheet {
  header: string[];
  map: ColumnMap;
  sample: string[][];
  rows: number;
  contacts: number;
  skipped: number;
}

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

async function send<T>(url: string, init: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, message: body.message ?? "That didn't work. Please try again." };
    return body as { ok: true } & T;
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}

export function loadContacts(opts: { q: string; list: string | null; offset: number }): Promise<Result<ContactsView>> {
  const p = new URLSearchParams({ q: opts.q, offset: String(opts.offset) });
  if (opts.list) p.set("list", opts.list);
  return send<ContactsView>(`/api/admin/marketing/contacts?${p}`, { cache: "no-store" });
}

export function changeContacts(body: Record<string, unknown>): Promise<Result<{ changed?: number; id?: string }>> {
  return send(`/api/admin/marketing/contacts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function checkSheet(file: File): Promise<Result<CheckedSheet>> {
  const form = new FormData();
  form.set("file", file);
  form.set("step", "check");
  return send<CheckedSheet>(`/api/admin/marketing/import`, { method: "POST", body: form });
}

export function importSheet(
  file: File,
  opts: { map: ColumnMap; source: string; consent: ConsentKind; consentNote: string; list: string },
): Promise<Result<{ added: number; updated: number; skipped: number }>> {
  const form = new FormData();
  form.set("file", file);
  form.set("step", "import");
  form.set("map", JSON.stringify(opts.map));
  form.set("source", opts.source);
  form.set("consent", opts.consent);
  form.set("consentNote", opts.consentNote);
  form.set("list", opts.list);
  return send(`/api/admin/marketing/import`, { method: "POST", body: form });
}

// ---- Campaigns, sequences, settings, pictures ----

export interface CampaignLine {
  id: string;
  name: string;
  subject: string;
  status: CampaignState;
  listId: string | null;
  listName: string | null;
  sendAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  counts: SendCounts;
}

export interface Campaign extends CampaignLine {
  content: EdmContent;
  sentBy: string | null;
}

export interface Recipient {
  email: string;
  name: string;
  company: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  status: string;
}

export interface CampaignView {
  campaign: Campaign;
  reach: { members: number; emailable: number } | null;
  recipients: Recipient[];
}

export interface SequenceLine {
  id: string;
  name: string;
  status: "on" | "off";
  onAt: string | null;
  updatedAt: string;
  active: number;
  finished: number;
  stopped: number;
  counts: SendCounts;
}

export interface Sequence extends SequenceLine {
  draft: SequenceDraft;
  stops: Partial<Record<StopReason, number>>;
}

export interface MarketingSettingsView {
  settings: { brand: EdmBrand; dailyCap: number; paused: boolean };
  ready: { email: boolean; siteUrl: boolean; cron: boolean; bounces: boolean };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const loadCampaigns = () => send<{ campaigns: CampaignLine[] }>(`/api/admin/marketing/campaigns`, { cache: "no-store" });
export const newCampaign = (name?: string) => send<{ id: string }>(`/api/admin/marketing/campaigns`, json("POST", { name }));
export const loadCampaign = (id: string) => send<CampaignView>(`/api/admin/marketing/campaigns/${id}`, { cache: "no-store" });
export const saveCampaignDraft = (id: string, body: { name: string; content: EdmContent; listId: string | null }) =>
  send(`/api/admin/marketing/campaigns/${id}`, json("PUT", body));
export const campaignAction = (id: string, body: Record<string, unknown>) =>
  send<{ to?: string; at?: string; id?: string; state?: CampaignState }>(`/api/admin/marketing/campaigns/${id}`, json("POST", body));
export const deleteCampaign = (id: string) => send(`/api/admin/marketing/campaigns/${id}`, { method: "DELETE" });

export const loadSequences = () => send<{ sequences: SequenceLine[] }>(`/api/admin/marketing/sequences`, { cache: "no-store" });
export const newSequence = (name?: string) => send<{ id: string }>(`/api/admin/marketing/sequences`, json("POST", { name }));
export const loadSequence = (id: string) => send<{ sequence: Sequence }>(`/api/admin/marketing/sequences/${id}`, { cache: "no-store" });
export const saveSequenceDraft = (id: string, draft: SequenceDraft) => send(`/api/admin/marketing/sequences/${id}`, json("PUT", { draft }));
export const switchSequence = (id: string, on: boolean) =>
  send(`/api/admin/marketing/sequences/${id}`, json("POST", { do: on ? "on" : "off" }));
export const deleteSequence = (id: string) => send(`/api/admin/marketing/sequences/${id}`, { method: "DELETE" });

export const loadMarketingSettings = () => send<MarketingSettingsView>(`/api/admin/marketing/settings`, { cache: "no-store" });
export const saveMarketingSettings = (s: MarketingSettingsView["settings"]) =>
  send<{ settings: MarketingSettingsView["settings"] }>(`/api/admin/marketing/settings`, json("PUT", s));

export function uploadMarketingImage(file: File) {
  const form = new FormData();
  form.set("file", file);
  return send<{ id: string }>(`/api/admin/marketing/images`, { method: "POST", body: form });
}
