/**
 * Job handover for the partner portal and the customer's installation record.
 * Saved in RENUABL's storage; where that isn't set up (a preview), on this device.
 */
import { emptyHandover, type EvidenceId, type HandoverPhoto, type HandoverRecord } from "@/lib/domain/handover";
import { prepareBillFile } from "./consumer";
import { devicePhotoUrl, getDeviceRecord, saveDevicePhoto, saveDeviceRecord } from "./device-records";

export type Backend = "server" | "device";

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
    return saveDeviceRecord({
      ...record,
      summary: opts.summary ?? record.summary,
      submittedAt: opts.submit ? new Date().toISOString() : record.submittedAt,
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
    return saveDeviceRecord({ ...record, photos: [...record.photos, entry] });
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
  if (backend === "device") return saveDeviceRecord({ ...record, photos: record.photos.filter((p) => p.id !== photoId) });
  const res = await fetch(`/api/jobs/${record.key}/photos?id=${encodeURIComponent(photoId)}`, { method: "DELETE" });
  const json = (await res.json()) as { ok: boolean; record?: HandoverRecord };
  if (!json.ok || !json.record) throw new Error("Couldn't remove that photo");
  return json.record;
}

/** Where to show a photo from: RENUABL's route, or this device. */
export async function photoSrc(recordKey: string, photoId: string, path: string): Promise<string | null> {
  return path.startsWith("device:") ? devicePhotoUrl(photoId) : `/api/jobs/${recordKey}/photos/${photoId}`;
}
