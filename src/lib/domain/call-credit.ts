/**
 * When the phone service turns a call away because its account has no credit left (17 Nov 2026, Martin: "Charlie isn't
 * calling me"; Vapi had answered "Your Wallet Balance is -0.07" and the window only said to try again). Trying again
 * can't help, so the member is told what is wrong. Pure, tested.
 */

/** Whether the phone service's refusal says its account is out of credit. */
export function outOfCallCredit(reason: unknown): boolean {
  const said = typeof reason === "string" ? reason.toLowerCase() : "";
  return /wallet balance|insufficient (credit|fund|balance)|out of credit|add (more )?credits?|purchase (more )?credits?/.test(said);
}

/** What the member is told: nothing went out, and why. */
export const OUT_OF_CALL_CREDIT =
  "No call went out: the phone service's call credit has run out. It needs topping up before any call can be placed.";
