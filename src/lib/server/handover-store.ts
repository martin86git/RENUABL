/**
 * Server only. Job handover records and photos, kept privately in storage at
 * jobs/<record key>/. The record key is long and random, so a record can only
 * be opened by someone who has its link.
 */
import {
  RECORD_KEY,
  emptyHandover,
  type EvidenceId,
  type HandoverDocument,
  type HandoverPhoto,
  type HandoverRecord,
} from "@/lib/domain/handover";
import { readFile, readJson, saveFile, saveJson } from "./storage";

export function validKey(key: string) {
  return RECORD_KEY.test(key);
}

const recordPath = (key: string) => `jobs/${key}/record.json`;

export async function getRecord(key: string): Promise<HandoverRecord | null> {
  return readJson<HandoverRecord>(recordPath(key));
}

export async function saveRecord(record: HandoverRecord): Promise<HandoverRecord> {
  const saved = { ...record, updatedAt: new Date().toISOString() };
  await saveJson(recordPath(record.key), saved);
  return saved;
}

export async function addPhoto(
  key: string,
  jobReference: string,
  photo: { category: EvidenceId; array?: number; data: ArrayBuffer; contentType: string },
): Promise<{ record: HandoverRecord; photo: HandoverPhoto }> {
  const id = `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ext = photo.contentType === "image/png" ? "png" : "jpg";
  const path = await saveFile(`jobs/${key}/photos/${photo.category}-${id}.${ext}`, photo.data, photo.contentType);
  const record = (await getRecord(key)) ?? emptyHandover(key, jobReference);
  const entry: HandoverPhoto = { id, category: photo.category, array: photo.array, path, takenAt: new Date().toISOString() };
  const saved = await saveRecord({ ...record, photos: [...record.photos, entry] });
  return { record: saved, photo: entry };
}

export async function removePhoto(key: string, photoId: string): Promise<HandoverRecord | null> {
  const record = await getRecord(key);
  if (!record) return null;
  return saveRecord({ ...record, photos: record.photos.filter((p) => p.id !== photoId) });
}

/** A photo's file, found through the record (never by a path from the request). */
export async function photoFile(key: string, photoId: string) {
  const record = await getRecord(key);
  const photo = record?.photos.find((p) => p.id === photoId);
  return photo ? readFile(photo.path) : null;
}

export async function addDocument(
  key: string,
  jobReference: string,
  doc: { docId: string; label?: string; name: string; data: ArrayBuffer; contentType: string },
): Promise<HandoverRecord> {
  const id = `dc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ext = doc.contentType === "application/pdf" ? "pdf" : doc.contentType === "image/png" ? "png" : "jpg";
  const path = await saveFile(`jobs/${key}/documents/${doc.docId}-${id}.${ext}`, doc.data, doc.contentType);
  const record = (await getRecord(key)) ?? emptyHandover(key, jobReference);
  const entry: HandoverDocument = {
    id,
    docId: doc.docId,
    label: doc.label,
    name: doc.name,
    path,
    contentType: doc.contentType,
    uploadedAt: new Date().toISOString(),
  };
  return saveRecord({ ...record, documents: [...(record.documents ?? []), entry] });
}

export async function removeDocument(key: string, id: string): Promise<HandoverRecord | null> {
  const record = await getRecord(key);
  if (!record) return null;
  return saveRecord({ ...record, documents: (record.documents ?? []).filter((d) => d.id !== id) });
}

/** A document's file, found through the record. */
export async function documentFile(key: string, id: string) {
  const record = await getRecord(key);
  const doc = record?.documents?.find((d) => d.id === id);
  return doc ? readFile(doc.path) : null;
}
