/**
 * What the sign-up page takes from someone who isn't signing up yet: an Enterprise enquiry (13 users or more) or
 * interest in the marketplace. Cleaned here, never trusted from the browser, and the email staff get. Pure, tested.
 */
import { normaliseEmail } from "@/lib/domain/accounts";
import { cleanDemoSource, demoSourceWords } from "./demo";
import { ENTERPRISE_FROM } from "./plans";

export interface Enquiry {
  name: string;
  business: string;
  email: string;
  mobile: string | null;
  users: number;
  note: string | null;
}

const words = (raw: unknown, most: number) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, most)
    : "";

/** An Enterprise enquiry, or why it can't be taken. */
export function cleanEnquiry(raw: Record<string, unknown>): Enquiry | string {
  const email = normaliseEmail(raw.email);
  const name = words(raw.name, 80);
  const business = words(raw.business, 120);
  const users = typeof raw.users === "string" ? Number(raw.users) : raw.users;
  const mobile = words(raw.mobile, 20).replace(/[^\d+ ]/g, "");
  if (!name) return "Tell us your name.";
  if (!business) return "Tell us your business's name.";
  if (!email) return "Enter a valid email address.";
  if (typeof users !== "number" || !Number.isInteger(users) || users < 1 || users > 5000) return "How many people would use it?";
  return { name, business, email, mobile: mobile.length >= 8 ? mobile : null, users, note: words(raw.note, 1000) || null };
}

/** The email RENUABL staff get for an enquiry (no reply-to the customer is set up here: staff call or email them). */
export function enquiryEmail(e: Enquiry): { subject: string; text: string } {
  const big = e.users >= ENTERPRISE_FROM;
  return {
    subject: `${big ? "Enterprise enquiry" : "Sales enquiry"}: ${e.business}, ${e.users} users`,
    text: [
      `${e.name} from ${e.business} asked to talk about RENUABL for ${e.users} users.`,
      "",
      `Email: ${e.email}`,
      `Mobile: ${e.mobile ?? "not given"}`,
      e.note ? `\nThey said:\n${e.note}` : "",
      "",
      "Reply to them within a business day.",
    ].join("\n"),
  };
}

/** The email staff get when someone registers interest in the marketplace. */
export function interestEmail(email: string): { subject: string; text: string } {
  return {
    subject: "Marketplace: someone registered interest",
    text: `${email} registered interest in the RENUABL marketplace from the sign-up page.`,
  };
}

/**
 * Book a demo, from the business page (21 Nov 2026, Martin: "request a demo" beside Get started; since 27 Nov 2026 the
 * only way to see RENUABL without signing up: "i dont want there to be access to the demo platform. you either have to
 * sign up, or book a demo in"). A person shows them RENUABL on a call; nobody opens a demo account themselves.
 */
export interface DemoRequest {
  name: string;
  business: string;
  email: string;
  mobile: string | null;
  note: string | null;
  /** When would suit them, in their own words ("Tuesday after 2"). Nothing is booked by it. */
  time: string | null;
  /** Where the link they followed came from (its utm tags), when it said: "rexel · wholesaler-launch". */
  from: string | null;
}

/** A demo request, or why it can't be taken. */
export function cleanDemoRequest(raw: Record<string, unknown>): DemoRequest | string {
  const email = normaliseEmail(raw.email);
  const name = words(raw.name, 80);
  const business = words(raw.business, 120);
  const mobile = words(raw.mobile, 20).replace(/[^\d+ ]/g, "");
  if (!name) return "Tell us your name.";
  if (!business) return "Tell us your business's name.";
  if (!email) return "Enter a valid email address.";
  const from = cleanDemoSource(raw);
  return {
    name,
    business,
    email,
    mobile: mobile.length >= 8 ? mobile : null,
    note: words(raw.note, 1000) || null,
    time: words(raw.time, 120) || null,
    from: from ? demoSourceWords(from) : null,
  };
}

/** What is kept on the lead as its note: when would suit, what they'd like to see, and where they came from. */
export function demoRequestNote(d: DemoRequest): string | null {
  const parts = [d.time ? `Would suit: ${d.time}` : "", d.note ?? "", d.from ? `Came from: ${d.from}` : ""].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

/** The email RENUABL staff get for a demo request. */
export function demoRequestEmail(d: DemoRequest): { subject: string; text: string } {
  return {
    subject: `Book a demo: ${d.business}`,
    text: [
      `${d.name} from ${d.business} asked to book a demo of RENUABL.`,
      "",
      `Email: ${d.email}`,
      `Mobile: ${d.mobile ?? "not given"}`,
      `Would suit: ${d.time ?? "not said"}`,
      ...(d.from ? [`Came from: ${d.from}`] : []),
      d.note ? `\nThey said:\n${d.note}` : "",
      "",
      "Get in touch within a business day to book it.",
    ].join("\n"),
  };
}
