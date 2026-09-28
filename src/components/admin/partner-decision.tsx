"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { decidePartner } from "@/lib/services/accounts";

/** Approve, decline or pause a partner; "Installer of choice" puts them first for jobs in their area. */
export function PartnerDecision({ id, status, priority }: { id: string; status: string; priority: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [preferred, setPreferred] = useState(priority > 0);
  async function act(action: "approve" | "decline" | "pause") {
    setBusy(true);
    await decidePartner(id, action, preferred ? 5 : 0);
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="mr-2 flex min-h-11 items-center gap-2 text-[13px] text-ink-2">
        <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} className="h-4 w-4" />
        Installer of choice
      </label>
      {status !== "approved" && (
        <Button size="sm" disabled={busy} onClick={() => void act("approve")}>
          Approve
        </Button>
      )}
      {status === "approved" && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("approve")}>
          Save
        </Button>
      )}
      {status === "approved" && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("pause")}>
          Pause offers
        </Button>
      )}
      {status === "pending" && (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("decline")}>
          Decline
        </Button>
      )}
    </div>
  );
}
