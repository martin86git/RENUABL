/** Staff: supplier price list uploads (checked first, then applied or discarded). */
import type { PriceChange } from "@/lib/domain/price-import";

export interface CheckedUpload {
  id: string;
  supplier: string;
  filename: string;
  changes: PriceChange[];
  unchanged: number;
  notInFile: { sku: string; name: string }[];
}

export async function checkPriceList(
  file: File,
  supplier: string,
): Promise<{ ok: true; upload: CheckedUpload } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("supplier", supplier);
  try {
    const res = await fetch("/api/admin/prices", { method: "POST", body });
    const json = (await res.json()) as {
      ok: boolean;
      message?: string;
      upload?: { id: string; supplier: string; filename: string; changes: PriceChange[]; unchanged: number };
      notInFile?: { sku: string; name: string }[];
    };
    if (!json.ok || !json.upload) return { ok: false, message: json.message ?? "We couldn't check that file." };
    return { ok: true, upload: { ...json.upload, notInFile: json.notInFile ?? [] } };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Please try again." };
  }
}

export async function decidePriceList(id: string, action: "apply" | "discard"): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/admin/prices/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return (await res.json()) as { ok: boolean; message?: string };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Please try again." };
  }
}
