/**
 * Server only. Whether a business has Marketing (a retailer's paid add-on, domain/design/add-ons.ts; RENUABL's own
 * business always), and
 * who its emails say they are from (its brand kit: name, ABN, email, phone, address).
 */
import { marketingUsable } from "@/lib/domain/design/add-ons";
import { cleanKind } from "@/lib/domain/design/business-kind";
import type { EdmSender } from "@/lib/domain/marketing/edm";
import { dbConfigured, query } from "./db";
import { standingOf } from "./design-addons";
import { loadBrand } from "./design-proposal-repo";
import { publicSiteUrl } from "@/lib/domain/site";
import { renuablCrm } from "./renuabl-crm";

/** RENUABL's own wordmark as the website shows it, sized for the top of an email (public/brand/renuabl-logo-email.png, 2x). */
// The dark wordmark with a soft white glow behind it (glowLogo), so it also reads when a phone's dark mode darkens the email.
export const RENUABL_EMAIL_LOGO = `${publicSiteUrl()}/brand/renuabl-logo-email-glow.png`;
export const RENUABL_EMAIL_LOGO_LIGHT = `${publicSiteUrl()}/brand/renuabl-logo-email-light.png`;

export async function marketingOn(businessId: string): Promise<boolean> {
  if (!dbConfigured()) return false;
  const [rows, standing] = await Promise.all([
    query<{ kind: string | null }>(`select kind from businesses where id = $1`, [businessId]),
    standingOf(businessId, "marketing"),
  ]);
  return marketingUsable({ retailer: cleanKind(rows[0]?.kind ?? undefined) === "retailer", standing });
}

/** Whether this is RENUABL's own business (its contacts signing up to RENUABL Business also count as becoming customers). */
export async function isRenuablBusiness(businessId: string): Promise<boolean> {
  const own = await renuablCrm().catch(() => null);
  return own?.businessId === businessId;
}

/** Who the business's emails are from: its brand kit, the owner's email standing in when the kit has none. */
export async function senderFor(businessId: string): Promise<EdmSender> {
  const rows = await query<{ name: string; owner: string | null }>(
    `select b.name, (select m.email from business_members m where m.business_id = b.id and m.role = 'owner' limit 1) as owner
       from businesses b where b.id = $1`,
    [businessId],
  );
  const name = rows[0]?.name ?? "";
  const [kit, own] = await Promise.all([loadBrand(businessId, name), isRenuablBusiness(businessId)]);
  return {
    name: (kit.name || name).trim(),
    abn: /^\d{11}$/.test(kit.abn) ? kit.abn : null,
    email: kit.email.trim() || rows[0]?.owner || null,
    phone: kit.phone.trim() || null,
    address: kit.address.trim() || null,
    // RENUABL's own emails carry its logo; another business's still name it in words (its logo isn't served publicly yet).
    logo: own ? RENUABL_EMAIL_LOGO : null,
    logoOnDark: own ? RENUABL_EMAIL_LOGO_LIGHT : null,
  };
}
