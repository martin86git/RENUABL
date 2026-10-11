import { redirect } from "next/navigation";

/** Settings opens on its first page. */
export default function DesignSettingsPage() {
  redirect("/design/settings/price-lists");
}
