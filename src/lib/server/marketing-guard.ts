/**
 * Server only. The check every Marketing route makes first: a signed-in member allowed the action (requireMember: the
 * permission, the business's kind, a demo kept from reaching anyone), in a business that has Marketing (marketingOn).
 */
import type { MemberAction } from "@/lib/domain/design/account";
import { MARKETING_OFF } from "@/lib/domain/marketing/access";
import { requireMember } from "./design-context";
import type { Member } from "./design-repo";
import { marketingOn } from "./marketing-access";

export async function marketingMember(action: MemberAction): Promise<{ member: Member } | { refuse: Response }> {
  const gate = await requireMember(action);
  if ("refuse" in gate) return gate;
  if (!(await marketingOn(gate.member.businessId)))
    return { refuse: Response.json({ ok: false, message: MARKETING_OFF }, { status: 404 }) };
  return gate;
}

export const refuse = (message: string, status = 422) => Response.json({ ok: false, message }, { status });

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
