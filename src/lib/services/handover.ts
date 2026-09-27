/**
 * Job handover for the partner portal and the customer's installation record.
 * Saved in RENUABL's storage; where that isn't set up (a preview), on this device.
 */
import { emptyHandover, type EvidenceId, type HandoverDocument, type HandoverPhoto, type HandoverRecord } from "@/lib/domain/handover";
import { updateConnection, type ConnectionProgress, type ConnectionStepId } from "@/lib/domain/connection";
import type { PartnerType } from "@/lib/domain/partner";
import { addVariation, cleanVariationInput, decideVariation, type VariationAction, type VariationItem } from "@/lib/domain/variations";
import { prepareBillFile } from "./consumer";
import { devicePhotoUrl, getDeviceRecord, saveDevicePhoto, saveDeviceRecord } from "./device-records";

export type Backend = "server" | "device";

/** On this device, change the latest saved copy (other parts of the page may have saved since). */
async function latestOnDevice(record: HandoverRecord): Promise<HandoverRecord> {
  return (await getDeviceRecord(record.key)) ?? record;
}

export async function loadHandover(key: string, jobReference: string): Promise<{ record: HandoverRecord; backend: Backend }> {
  try {
    const res = await fetch(`/api/jobs/${key}/handover`, { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; record?: HandoverRecord; notConfigured?: boolean };
    if (json.ok && json.record) return { record: json.record, backend: "server" };
    if (res.status === 404) return { record: emptyHandover(key, jobReference), backend: "server" };
  } catch {
    /* offline: fall through to this device */
  }
  return { record: (await getDeviceRecord(key)) ?? emptyHandover(key, jobReference), backend: "device" };
}

/** Reads a record for the customer: from RENUABL, else one kept on this device; null if there isn't one. */
export async function findRecord(key: string): Promise<{ record: HandoverRecord; backend: Backend } | null> {
  try {
    const res = await fetch(`/api/jobs/${key}/handover`, { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; record?: HandoverRecord };
    if (json.ok && json.record) return { record: json.record, backend: "server" };
  } catch {
    /* fall through */
  }
  const local = await getDeviceRecord(key);
  return local ? { record: local, backend: "device" } : null;
}

export async function saveHandover(
  record: HandoverRecord,
  backend: Backend,
  opts: { submit?: boolean; summary?: HandoverRecord["summary"] } = {},
): Promise<HandoverRecord> {
  if (backend === "device") {
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({
      ...latest,
      arrays: record.arrays,
      serials: record.serials,
      summary: opts.summary ?? latest.summary,
      submittedAt: opts.submit ? new Date().toISOString() : latest.submittedAt,
    });
  }
  const res = await fetch(`/api/jobs/${record.key}/handover`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobReference: record.jobReference, arrays: record.arrays, serials: record.serials, ...opts }),
  });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord };
  if (!json.ok || !json.record) throw new Error("Couldn't save the handover");
  return json.record;
}

export async function addHandoverPhoto(
  record: HandoverRecord,
  backend: Backend,
  category: EvidenceId,
  array: number | undefined,
  file: File,
): Promise<HandoverRecord> {
  const photo = await prepareBillFile(file, 1_200_000);
  if (backend === "device") {
    const id = `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await saveDevicePhoto(id, photo);
    const entry: HandoverPhoto = { id, category, array, path: `device:${id}`, takenAt: new Date().toISOString() };
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({ ...latest, photos: [...latest.photos, entry] });
  }
  const body = new FormData();
  body.append("category", category);
  if (array) body.append("array", String(array));
  body.append("jobReference", record.jobReference);
  body.append("photo", photo);
  const res = await fetch(`/api/jobs/${record.key}/photos`, { method: "POST", body });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord; message?: string };
  if (!json.ok || !json.record) throw new Error(json.message ?? "That photo didn't upload. Try again.");
  return json.record;
}

export async function removeHandoverPhoto(record: HandoverRecord, backend: Backend, photoId: string): Promise<HandoverRecord> {
  if (backend === "device") {
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({ ...latest, photos: latest.photos.filter((p) => p.id !== photoId) });
  }
  const res = await fetch(`/api/jobs/${record.key}/photos?id=${encodeURIComponent(photoId)}`, { method: "DELETE" });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord };
  if (!json.ok || !json.record) throw new Error("Couldn't remove that photo");
  return json.record;
}

/** Where to show a photo from: RENUABL's route, or this device. */
export async function photoSrc(recordKey: string, photoId: string, path: string): Promise<string | null> {
  return path.startsWith("device:") ? devicePhotoUrl(photoId) : `/api/jobs/${recordKey}/photos/${photoId}`;
}

/** Adds a page or file (PDF or photo, shrunk first) to one of the job's documents. */
export async function addHandoverDocument(
  record: HandoverRecord,
  backend: Backend,
  doc: { id: string; label: string },
  file: File,
): Promise<HandoverRecord> {
  const docId = doc.id;
  const prepared = file.type === "application/pdf" ? file : await prepareBillFile(file, 1_500_000);
  if (backend === "device") {
    const id = `dc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await saveDevicePhoto(id, prepared);
    const entry: HandoverDocument = {
      id,
      docId,
      label: doc.label,
      name: prepared.name,
      path: `device:${id}`,
      contentType: prepared.type,
      uploadedAt: new Date().toISOString(),
    };
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({ ...latest, documents: [...(latest.documents ?? []), entry] });
  }
  const body = new FormData();
  body.append("docId", docId);
  body.append("label", doc.label);
  body.append("jobReference", record.jobReference);
  body.append("file", prepared);
  const res = await fetch(`/api/jobs/${record.key}/documents`, { method: "POST", body });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord; message?: string };
  if (!json.ok || !json.record) throw new Error(json.message ?? "That didn't upload. Try again.");
  return json.record;
}

export async function removeHandoverDocument(record: HandoverRecord, backend: Backend, id: string): Promise<HandoverRecord> {
  if (backend === "device") {
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({ ...latest, documents: (latest.documents ?? []).filter((d) => d.id !== id) });
  }
  const res = await fetch(`/api/jobs/${record.key}/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord };
  if (!json.ok || !json.record) throw new Error("Couldn't remove that file");
  return json.record;
}

/** Where to open a document page or file from: RENUABL's route, or this device. */
export async function documentSrc(recordKey: string, id: string, path: string): Promise<string | null> {
  return path.startsWith("device:") ? devicePhotoUrl(id) : `/api/jobs/${recordKey}/documents/${id}`;
}

// ---------------------------------------------------------------------------
// Variations and grid connection (kept with the installation record)
// ---------------------------------------------------------------------------

async function postRecord(url: string, method: "POST" | "PUT", body: unknown): Promise<HandoverRecord> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; record?: HandoverRecord; message?: string };
  if (!json.ok || !json.record) throw new Error(json.message ?? "That didn't save. Try again.");
  return json.record;
}

/** Sends a variation to the customer. On the server it's priced there; on this device, here. */
export async function sendVariation(
  record: HandoverRecord,
  backend: Backend,
  input: { reason: string; items: VariationItem[] },
  pricing: { type: PartnerType; margin?: number },
): Promise<HandoverRecord> {
  if (backend === "device") {
    const clean = cleanVariationInput(input);
    if (!clean) throw new Error("Add what the work is, a price for each item, and why it's needed.");
    const latest = await latestOnDevice(record);
    const id = `var_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return saveDeviceRecord({
      ...latest,
      variations: addVariation(latest.variations, clean, pricing, { id, now: new Date().toISOString() }),
    });
  }
  return postRecord(`/api/jobs/${record.key}/variations`, "POST", { jobReference: record.jobReference, ...input });
}

/** The customer approves or declines, or the partner withdraws, a variation. */
export async function answerVariation(
  record: HandoverRecord,
  backend: Backend,
  id: string,
  action: VariationAction,
): Promise<HandoverRecord> {
  if (backend === "device") {
    const latest = await latestOnDevice(record);
    const variations = decideVariation(latest.variations, id, action, new Date().toISOString());
    if (!variations) throw new Error("This has already been answered.");
    return saveDeviceRecord({ ...latest, variations });
  }
  return postRecord(`/api/jobs/${record.key}/variations/${id}`, "POST", { action });
}

/** Ticks off (or un-ticks) a grid connection or rebate step. */
export async function setConnectionStep(
  record: HandoverRecord,
  backend: Backend,
  step: ConnectionStepId,
  value: ConnectionProgress | null,
): Promise<HandoverRecord> {
  if (backend === "device") {
    const latest = await latestOnDevice(record);
    return saveDeviceRecord({ ...latest, connection: updateConnection(latest.connection, step, value) });
  }
  return postRecord(`/api/jobs/${record.key}/connection`, "PUT", {
    jobReference: record.jobReference,
    step,
    done: value?.done ?? null,
    reference: value?.reference,
  });
}
