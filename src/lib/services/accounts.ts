import type { PlacedPanel } from "@/lib/domain/panel-plan";
import type { ObstructionCheck } from "@/lib/domain/obstructions";

/** Sign-in for customers and partners: a one-time link sent by email. */
export async function requestLoginLink(
  email: string,
  as: "customer" | "partner",
  next?: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/auth/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, as, next }),
    });
    const json = (await res.json()) as { ok: boolean; message?: string };
    return json.ok
      ? { ok: true, message: json.message ?? "Check your email for a sign-in link." }
      : { ok: false, message: json.message ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** A partner accepts or declines a job offer. */
export async function answerOffer(offerId: string, action: "accept" | "decline"): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    return (await res.json()) as { ok: boolean; message?: string };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** Staff approve, decline or pause a partner. */
export async function decidePartner(id: string, action: "approve" | "decline" | "pause", priority?: number) {
  try {
    const res = await fetch(`/api/admin/partners/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, priority }),
    });
    return (await res.json()) as { ok: boolean; status?: string };
  } catch {
    return { ok: false };
  }
}

/** A signed-in partner moves their own job forward. */
export async function saveJobStage(jobId: string, status: "scheduled" | "in-progress" | "completed"): Promise<boolean> {
  try {
    const res = await fetch(`/api/partner/jobs/${jobId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return ((await res.json()) as { ok: boolean }).ok;
  } catch {
    return false;
  }
}

/** Runs the roof obstruction check on the job's satellite image. */
export async function checkRoof(recordKey: string): Promise<{ ok: true; check: ObstructionCheck } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/jobs/${recordKey}/obstructions`, { method: "POST" });
    const json = (await res.json()) as { ok: boolean; check?: ObstructionCheck; message?: string };
    return json.ok && json.check
      ? { ok: true, check: json.check }
      : { ok: false, message: json.message ?? "The roof check didn't work. Try again." };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** The job's partner saves its panel layout. */
export async function saveLayout(recordKey: string, panels: PlacedPanel[]): Promise<{ ok: boolean; arrays?: number; message?: string }> {
  try {
    const res = await fetch(`/api/jobs/${recordKey}/layout`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panels }),
    });
    return (await res.json()) as { ok: boolean; arrays?: number; message?: string };
  } catch {
    return { ok: false, message: "That didn't save. Check your connection and try again." };
  }
}
