/** Partner sign-up: sends the application and certificate to RENUABL. */
import type { PartnerErrors } from "@/lib/domain/partner";
import { prepareBillFile } from "./consumer";

export type PartnerApplyResult = { ok: true; reference: string } | { ok: false; message?: string; errors?: PartnerErrors };

export async function submitPartnerApplication(
  application: Record<string, unknown>,
  certificate: File | null,
): Promise<PartnerApplyResult> {
  const body = new FormData();
  body.append("application", JSON.stringify(application));
  if (certificate) body.append("certificate", certificate);
  try {
    const res = await fetch("/api/partners/apply", { method: "POST", body });
    const json = (await res.json()) as { ok: boolean; reference?: string; message?: string; errors?: PartnerErrors };
    return json.ok && json.reference ? { ok: true, reference: json.reference } : { ok: false, message: json.message, errors: json.errors };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** A photo of the certificate is shrunk on the phone (PDFs are sent as they are), so it uploads quickly and fits the limit. */
export async function prepareCertificate(file: File): Promise<File> {
  return file.type === "application/pdf" ? file : prepareBillFile(file, 1_500_000);
}

export { resolveAddress, suggestAddresses } from "./consumer";

/** Sends a renewed licence or insurance certificate for RENUABL to review. */
export async function submitComplianceRenewal(input: {
  kind: string;
  expires: string;
  number?: string;
  amount?: number;
  file: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const form = new FormData();
  form.set("kind", input.kind);
  form.set("expires", input.expires);
  if (input.number) form.set("number", input.number);
  if (input.amount) form.set("amount", String(input.amount));
  form.set("file", await prepareCertificate(input.file));
  try {
    const res = await fetch("/api/partners/compliance", { method: "POST", body: form });
    const json = (await res.json()) as { ok: boolean; message?: string };
    return json.ok ? { ok: true } : { ok: false, message: json.message ?? "That didn't send. Try again." };
  } catch {
    return { ok: false, message: "That didn't send. Check your connection and try again." };
  }
}
