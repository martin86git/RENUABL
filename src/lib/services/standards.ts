/**
 * A business's library of its own licensed standards (Settings → Standards and regulations): list, upload a copy in
 * parts, open, remove. Signed in only.
 */
import type { StandardCopy } from "@/lib/domain/design/standards";
import { ask } from "./crm";

export const loadStandards = () => ask<{ copies: StandardCopy[] }>("/api/design/standards");

export const standardHref = (id: string) => `/api/design/standards/${id}`;

export const removeStandard = (id: string) => ask<{ copies: StandardCopy[] }>(standardHref(id), { method: "DELETE" });

/** Uploads a copy: says what it is, sends it a part at a time (each under the host's request limit), then finishes it. */
export async function uploadStandard(
  file: File,
  about: { code: string; title: string; edition: string; licence: boolean },
  progress: (share: number) => void,
): Promise<{ ok: true; copies: StandardCopy[] } | { ok: false; message: string }> {
  const start = await ask<{ id: string; parts: number; partBytes: number }>("/api/design/standards", {
    method: "POST",
    body: { ...about, fileName: file.name, size: file.size },
  });
  if (!start.ok) return start;
  try {
    for (let n = 0; n < start.parts; n++) {
      const part = file.slice(n * start.partBytes, (n + 1) * start.partBytes);
      let res = await fetch(`${standardHref(start.id)}?part=${n}`, { method: "PUT", body: part });
      if (!res.ok && res.status >= 500) res = await fetch(`${standardHref(start.id)}?part=${n}`, { method: "PUT", body: part });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        void removeStandard(start.id);
        return { ok: false, message: json?.message ?? "Part of the file couldn't be sent. Try again." };
      }
      progress((n + 1) / start.parts);
    }
  } catch {
    void removeStandard(start.id);
    return { ok: false, message: "The file couldn't be sent. Check your connection and try again." };
  }
  return ask<{ copies: StandardCopy[] }>(standardHref(start.id), { method: "POST", body: { do: "finish" } });
}
