/** The Home Health check, from the browser: save the answers. */
import type { ConsentState } from "@/components/consumer/consent-boxes";
import type { HealthAnswers } from "@/lib/domain/home-health";

export async function saveHomeHealth(input: {
  answers: HealthAnswers;
  sensitiveConsent: boolean;
  reference?: string;
  email?: string;
  address?: string;
  consent?: ConsentState;
}): Promise<{ ok: boolean; id?: string; message?: string; consent?: boolean }> {
  try {
    const res = await fetch("/api/home-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as { ok: boolean; id?: string; message?: string; consent?: boolean };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}
