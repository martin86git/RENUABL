/**
 * Server only. Private file storage on Vercel Blob (BLOB_READ_WRITE_TOKEN,
 * from a private Blob store connected to the project). Used for partners'
 * insurance certificates and applications, and for job handover records and
 * photos. Nothing here is public: files are read back only through our own
 * routes. Without a token, storage reports that it isn't set up.
 */
import { BlobNotFoundError, get, put } from "@vercel/blob";

export class StorageError extends Error {}

export function storageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function token() {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!t) throw new StorageError("Storage isn't set up (BLOB_READ_WRITE_TOKEN)");
  return t;
}

/** Saves a file; returns its stored pathname (with a random suffix so names never clash). */
export async function saveFile(pathname: string, body: Blob | ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const data = body instanceof ArrayBuffer ? Buffer.from(body) : body;
  const blob = await put(pathname, data, { access: "private", contentType, addRandomSuffix: true, token: token() });
  return blob.pathname;
}

export async function saveJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: token(),
  });
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const res = await get(pathname, { access: "private", useCache: false, token: token() });
    if (!res?.stream) return null;
    return (await new Response(res.stream).json()) as T;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

/** A stored file as a stream, for our own routes to pass on. */
export async function readFile(pathname: string): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    const res = await get(pathname, { access: "private", token: token() });
    if (!res?.stream) return null;
    return { stream: res.stream, contentType: res.blob.contentType ?? "application/octet-stream" };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}
