import { redirect } from "next/navigation";

/** The business's account is Settings' "Users and permissions". */
export default function DesignAccountRoute() {
  redirect("/design/settings/users");
}
