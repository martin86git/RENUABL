import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for Vercel Blob storage.
const files = new Map<string, { data: string; contentType: string }>();
vi.mock("./storage", () => ({
  storageConfigured: () => true,
  saveFile: async (path: string, body: ArrayBuffer, contentType: string) => {
    const stored = path.replace(/(\.\w+)$/, "-abc123$1");
    files.set(stored, { data: Buffer.from(body).toString("base64"), contentType });
    return stored;
  },
  saveJson: async (path: string, value: unknown) => void files.set(path, { data: JSON.stringify(value), contentType: "application/json" }),
  readJson: async (path: string) => (files.has(path) ? JSON.parse(files.get(path)!.data) : null),
  readFile: async (path: string) => (files.has(path) ? { stream: new ReadableStream(), contentType: files.get(path)!.contentType } : null),
}));

const { addDocument, addPhoto, documentFile, getRecord, photoFile, removeDocument, removePhoto, saveRecord, validKey } =
  await import("./handover-store");
const key = "abcdefghijklmnopqrst";

describe("handover store", () => {
  beforeEach(() => files.clear());

  it("only accepts long random record keys", () => {
    expect(validKey(key)).toBe(true);
    expect(validKey("job_1043")).toBe(false);
    expect(validKey("../partners/x")).toBe(false);
  });

  it("adds photos to a new record, keeps them private, and removes them", async () => {
    const { record, photo } = await addPhoto(key, "RN-1043", {
      category: "array",
      array: 2,
      data: new ArrayBuffer(8),
      contentType: "image/jpeg",
    });
    expect(record.jobReference).toBe("RN-1043");
    expect(record.photos).toHaveLength(1);
    expect(photo.array).toBe(2);
    expect(photo.path.startsWith(`jobs/${key}/photos/array-`)).toBe(true);
    expect(await photoFile(key, photo.id)).not.toBeNull();
    // A photo id from another record can't be read through this one.
    expect(await photoFile("zzzzzzzzzzzzzzzzzzzz", photo.id)).toBeNull();
    const after = await removePhoto(key, photo.id);
    expect(after!.photos).toHaveLength(0);
  });

  it("saves serials alongside photos and stamps the time", async () => {
    await addPhoto(key, "RN-1043", { category: "inverter", data: new ArrayBuffer(8), contentType: "image/png" });
    const current = (await getRecord(key))!;
    const saved = await saveRecord({ ...current, serials: { panels: ["JKM475N00001"], inverter: "SG10RS2026A001", batteries: [] } });
    expect(saved.updatedAt).not.toBe("");
    const reread = (await getRecord(key))!;
    expect(reread.photos).toHaveLength(1);
    expect(reread.serials.inverter).toBe("SG10RS2026A001");
  });

  it("keeps job documents page by page, readable only through their record", async () => {
    let r = await addDocument(key, "RN-1043", {
      docId: "d4",
      label: "Certificate of compliance",
      name: "p1.jpg",
      data: new ArrayBuffer(4),
      contentType: "image/jpeg",
    });
    r = await addDocument(key, "RN-1043", {
      docId: "d4",
      label: "Certificate of compliance",
      name: "p2.pdf",
      data: new ArrayBuffer(4),
      contentType: "application/pdf",
    });
    expect(r.documents).toHaveLength(2);
    expect(r.documents![1].path).toMatch(new RegExp(`^jobs/${key}/documents/d4-dc_.*\\.pdf$`));
    expect(await documentFile(key, r.documents![0].id)).not.toBeNull();
    expect(await documentFile("zzzzzzzzzzzzzzzzzzzz", r.documents![0].id)).toBeNull();
    const after = await removeDocument(key, r.documents![0].id);
    expect(after!.documents!.map((d) => d.name)).toEqual(["p2.pdf"]);
  });
});
