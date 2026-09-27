/**
 * Installation records kept on this device (IndexedDB), used when RENUABL's
 * storage isn't set up (e.g. a preview). Photos stay on the device; nothing
 * is uploaded.
 */
import type { HandoverRecord } from "@/lib/domain/handover";

const DB = "renuabl-records";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("records");
      req.result.createObjectStore("photos");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: "records" | "photos", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDeviceRecord(key: string): Promise<HandoverRecord | null> {
  try {
    return ((await run("records", "readonly", (s) => s.get(key))) as HandoverRecord | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveDeviceRecord(record: HandoverRecord): Promise<HandoverRecord> {
  const saved = { ...record, updatedAt: new Date().toISOString() };
  await run("records", "readwrite", (s) => s.put(saved, record.key));
  return saved;
}

export async function saveDevicePhoto(id: string, blob: Blob): Promise<void> {
  await run("photos", "readwrite", (s) => s.put(blob, id));
}

export async function devicePhotoUrl(id: string): Promise<string | null> {
  try {
    const blob = (await run("photos", "readonly", (s) => s.get(id))) as Blob | undefined;
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}
