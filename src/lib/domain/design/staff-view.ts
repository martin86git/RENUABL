/**
 * View as a solar retailer, an installer or an electrical inspector (3 Nov 2026, Martin, under Settings): for RENUABL's
 * own staff only (`ADMIN_EMAILS`), never a business. It signs the staff member into a sample business of that kind,
 * with work in it, so every page of that login has something to show; their own sign-in is kept to come back to.
 * Pure, tested in `staff-view.test.ts`.
 */
import type { BusinessKind } from "./business-kind";

export interface SampleBusiness {
  kind: BusinessKind;
  /** On a reserved domain (`.example`): nothing is ever delivered to it. */
  email: string;
  name: string;
  /** Where it is, for the directory. */
  suburb: string;
  /** What looking through its login shows, in a line. */
  about: string;
}

export const SAMPLE_BUSINESSES: readonly SampleBusiness[] = [
  {
    kind: "retailer",
    email: "sample-retailer@renuabl-staff.example",
    name: "Sample Solar Retail (RENUABL staff)",
    suburb: "Glen Waverley",
    about: "Sells and runs the whole job: leads, designs, proposals, ordering and installation.",
  },
  {
    kind: "installer",
    email: "sample-installer@renuabl-staff.example",
    name: "Sample Installs (RENUABL staff)",
    suburb: "Clayton",
    about: "Installs for retailers: jobs sent to it, the Marketplace and the design tool.",
  },
  {
    kind: "inspector",
    email: "sample-inspector@renuabl-staff.example",
    name: "Sample Inspections (RENUABL staff)",
    suburb: "Dandenong",
    about: "Inspects installations: jobs installers nominate it for, with the design and photos.",
  },
];

/** The cookie that keeps the staff member's own session while they look through a sample business. */
export const STAFF_RETURN_COOKIE = "renuabl_staff_return";

export const sampleOf = (kind: unknown): SampleBusiness | null => SAMPLE_BUSINESSES.find((s) => s.kind === kind) ?? null;

/** Whether an email is one of the sample businesses' (so the bar can say which is being looked through). */
export const sampleByEmail = (email: string | null | undefined): SampleBusiness | null =>
  SAMPLE_BUSINESSES.find((s) => s.email === (email ?? "").toLowerCase()) ?? null;
