"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { WhoopStatus } from "@/lib/domain/whoop-offer";
import { setWhoop } from "@/lib/services/admin-healthy";

export function WhoopActions({ reference, status }: { reference: string; status: WhoopStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (next: "shipped" | "delivered" | "released") => {
    if (
      next === "released" &&
      !window.confirm(`Release the WHOOP for ${reference}? Only do this if the order was cancelled before installation.`)
    )
      return;
    setBusy(true);
    await setWhoop(reference, next);
    setBusy(false);
    router.refresh();
  };
  if (status === "claimed")
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void act("shipped")}>
          Mark shipped
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("released")}>
          Release
        </Button>
      </div>
    );
  if (status === "shipped")
    return (
      <Button size="sm" disabled={busy} onClick={() => void act("delivered")}>
        Mark delivered
      </Button>
    );
  return null;
}
