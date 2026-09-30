/** Staff actions for the WHOOP offer and healthy home quotes (the server checks the staff session). */
async function post(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return ((await res.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
}

export const setWhoop = (reference: string, status: "shipped" | "delivered" | "released") =>
  post("/api/admin/whoop", { reference, status });
export const setQuote = (id: string, status: "contacted" | "quoted") => post("/api/admin/health-quotes", { id, status });
