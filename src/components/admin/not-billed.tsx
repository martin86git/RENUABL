"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Staff: stop billing a business, or bill it again (server/design-not-billed.ts). */
export function NotBilledSwitch({ businessId, name, notBilled }: { businessId: string; name: string; notBilled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const set = async (on: boolean) => {
    const ask = on
      ? `Stop billing ${name}? It goes in without choosing a plan, Sol and design jobs are never refused, and every add-on is included.`
      : `Bill ${name} again? Its owner is asked to choose a plan the next time they open RENUABL.`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    const r = await fetch("/api/admin/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId, notBilled: on }),
    })
      .then((res) => res.json() as Promise<{ ok: boolean; message?: string }>)
      .catch(() => ({ ok: false, message: "That didn't go through." }));
    setBusy(false);
    if (!r.ok) window.alert(r.message ?? "That didn't go through.");
    router.refresh();
  };
  return notBilled ? (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void set(false)}>
      Bill again
    </Button>
  ) : (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void set(true)}>
      Don&rsquo;t bill
    </Button>
  );
}
