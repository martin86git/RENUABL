import { redirect } from "next/navigation";

/**
 * A short address for RENUABL Business (5 Nov 2026, Martin: reached by typing /design or /crm, never linked while it
 * isn't launched): straight on to /design, which signs a business in or opens its Today.
 */
export default function CrmPage() {
  redirect("/design");
}
