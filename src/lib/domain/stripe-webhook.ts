/**
 * The Stripe webhook's signing secrets (26 Nov 2026: every delivery to both endpoints answered "Invalid signature").
 * One URL takes RENUABL's own account's events (STRIPE_WEBHOOK_SECRET) and its connected accounts' events
 * (STRIPE_CONNECT_WEBHOOK_SECRET), so both are tried. Each variable may hold several, comma or space apart (while a
 * secret is being rolled), and quote marks pasted with a value are forgiven.
 */
export function webhookSecrets(...values: (string | undefined)[]): string[] {
  return values
    .flatMap((v) => (v ?? "").split(/[\s,]+/))
    .map((v) => v.replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
}
