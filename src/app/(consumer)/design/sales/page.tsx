import { redirect } from "next/navigation";

/** Sales opens on its feed (23 Nov 2026, Martin: "Feed moves into deals as the landing view"). */
export default function DesignSalesPage() {
  redirect("/design/sales/feed");
}
