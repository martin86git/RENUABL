import { redirect } from "next/navigation";

/** The Install Scheduler is now the Installations page's calendar (8 Nov 2026). */
export default function Page() {
  redirect("/design/installations");
}
