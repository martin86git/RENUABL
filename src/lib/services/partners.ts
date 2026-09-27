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
