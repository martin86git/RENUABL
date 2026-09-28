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
