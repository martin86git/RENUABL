import { redirect } from "next/navigation";

/** Proposal branding now lives across Settings: it opens on the company's own page. */
export default function DesignBrandPage() {
  redirect("/design/settings/company");
}
