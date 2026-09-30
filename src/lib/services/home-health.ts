/** The Home Health check, from the browser: save the answers, and ask for quotes. */
import type { ConsentState } from "@/components/consumer/consent-boxes";
import type { HealthAnswers, HealthItemId } from "@/lib/domain/home-health";

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

export async function requestHealthQuote(id: string, item: HealthItemId): Promise<boolean> {
  try {
    const res = await fetch("/api/home-health/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, item }),
    });
    return ((await res.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}
