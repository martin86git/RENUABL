/**
 * Server only. View as a retailer, an installer or an inspector, for RENUABL's staff (domain/design/staff-view.ts):
 * who the staff member is (signed in as themselves, or looking through a sample business with their own session kept
 * in `STAFF_RETURN_COOKIE`), and the sample businesses, made on first use with a directory listing each and the
 * retailer connected to the installer and the installer to the inspector, so Connections, Jobs and Inspections have
 * someone in them.
 */
import { cookies } from "next/headers";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { SAMPLE_BUSINESSES, STAFF_RETURN_COOKIE, type SampleBusiness } from "@/lib/domain/design/staff-view";
import { SESSION_COOKIE } from "@/lib/domain/accounts";
import { isStaff, sessionEmail } from "./accounts";
import { answerConnection, askToConnect, connectionsOf, saveListing, searchDirectory } from "./design-connections-repo";
import { createBusiness, memberByEmail } from "./design-repo";
import type { Member } from "./design-repo";

/**
 * The staff member behind this browser: their own session's email when it is on `ADMIN_EMAILS`, or, while they look
 * through a sample business, the email of the session kept aside. Null for anyone else.
 */
export async function staffBehind(): Promise<string | null> {
  const jar = await cookies();
  const kept = await sessionEmail(jar.get(STAFF_RETURN_COOKIE)?.value);
  if (kept) return isStaff(kept) ? kept : null;
  const own = await sessionEmail(jar.get(SESSION_COOKIE)?.value);
  return own && isStaff(own) ? own : null;
}

/** The sample business's member, made the first time it is needed. */
async function sampleMember(sample: SampleBusiness) {
  const found = await memberByEmail(sample.email);
  if (found) return found;
  const made = await createBusiness(sample.email, sample.name, BUSINESS_TERMS_VERSION, sample.kind);
  await saveListing(made.businessId, { listed: true, suburb: sample.suburb, state: "VIC", abn: "" }, sample.email);
  return made;
}

/** Connects two sample businesses, once: the first asks, the second accepts. */
async function connect(a: Member, b: Member) {
  const found = (await searchDirectory(a.businessId, b.businessName.split(" ").slice(0, 2).join(" "), "all")).find(
    (e) => e.name === b.businessName,
  );
  if (!found || found.standing === "connected") return;
  if (found.standing === "none") await askToConnect(a, found.key);
  const line = (await connectionsOf(b.businessId)).find((l) => l.business.name === a.businessName && l.standing === "incoming");
  if (line) await answerConnection(b, line.id, "accept");
}

/** Every sample business, made and connected if they aren't yet. */
export async function readySamples() {
  const [retailer, installer, inspector] = await Promise.all(SAMPLE_BUSINESSES.map(sampleMember));
  await connect(retailer, installer).catch(() => undefined);
  await connect(installer, inspector).catch(() => undefined);
}
