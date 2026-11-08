import { redirect } from "next/navigation";

/** In the works is now the Installations list (8 Nov 2026). */
export default function InstallationsInTheWorksPage() {
  redirect("/design/installations?view=list");
}
