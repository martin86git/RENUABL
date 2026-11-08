"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PATHS } from "./design-shell";
import { SchedulerPage } from "./design-scheduler";
import { InstallListPage, InstallViewSwitch, type InstallView } from "./install-lists";

/**
 * /design/installations (8 Nov 2026, Martin: the Install calendar, Upcoming and In the works were the same jobs seen
 * two ways): one page, Calendar or List, the choice kept in the address (?view=list).
 */
export function InstallationsPage({ initial }: { initial: InstallView }) {
  const router = useRouter();
  const [view, setView] = useState<InstallView>(initial);
  const choose = (v: InstallView) => {
    setView(v);
    router.replace(v === "list" ? `${PATHS.installations}?view=list` : PATHS.installations, { scroll: false });
  };
  const switcher = <InstallViewSwitch view={view} onView={choose} />;
  return view === "list" ? <InstallListPage switcher={switcher} /> : <SchedulerPage switcher={switcher} />;
}
