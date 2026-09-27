/** What a Stripe key is, from its prefix, without revealing any of it. */
export function stripeKeyMode(key: string | undefined): "test" | "live" | "invalid" | "missing" {
  const k = key?.trim();
  if (!k) return "missing";
  if (/^(sk|rk)_test_/.test(k)) return "test";
  if (/^(sk|rk)_live_/.test(k)) return "live";
  return "invalid";
}
