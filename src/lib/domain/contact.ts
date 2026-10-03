/** The customer's contact details, collected when they reserve an install date. */

export interface ContactDetails {
  firstName: string;
  lastName: string;
  /** Australian mobile, stored as +614XXXXXXXX. */
  mobile: string;
  email: string;
}

export type ContactErrors = Partial<Record<keyof ContactDetails, string>>;

/** Accepts 04XX XXX XXX, +61 4XX XXX XXX or 614XXXXXXXX; returns +614XXXXXXXX or null. */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^614\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(
  raw: Partial<Record<keyof ContactDetails, unknown>>,
): { contact: ContactDetails } | { errors: ContactErrors } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
  const firstName = text(raw.firstName);
  const lastName = text(raw.lastName);
  const email = text(raw.email).toLowerCase();
  const mobile = normaliseMobile(text(raw.mobile));

  const errors: ContactErrors = {};
  if (!firstName) errors.firstName = "Please enter your first name.";
  if (!lastName) errors.lastName = "Please enter your last name.";
  if (!mobile) errors.mobile = "Please enter an Australian mobile, e.g. 0412 345 678.";
  if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  if (Object.keys(errors).length > 0) return { errors };
  return { contact: { firstName, lastName, mobile: mobile!, email } };
}

/** "Don't have your bill handy?": an email, an Australian mobile, or both. At least one is needed. */
export function readFollowUpContact(raw: {
  email?: unknown;
  mobile?: unknown;
}): { email: string | null; mobile: string | null } | { error: string } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
  const rawEmail = text(raw.email).toLowerCase();
  const rawMobile = text(raw.mobile);
  if (!rawEmail && !rawMobile) return { error: "Enter your email or mobile so we can get in touch." };
  const email = rawEmail ? (EMAIL.test(rawEmail) ? rawEmail : null) : null;
  if (rawEmail && !email) return { error: "Enter a valid email address." };
  const mobile = rawMobile ? normaliseMobile(rawMobile) : null;
  if (rawMobile && !mobile) return { error: "Enter an Australian mobile, e.g. 0412 345 678." };
  return { email, mobile };
}
