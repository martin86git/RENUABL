"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { AddOnKey } from "@/lib/domain/design/add-ons";
import { staffAttachNumber, staffEnd, staffSwitchOn } from "@/lib/services/addons";

/** Staff: switch an add-on on once its price is agreed, or end one (domain/design/add-ons.ts). */
export function AddOnActions({ businessId, addOn, on }: { businessId: string; addOn: AddOnKey; on: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (go: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const r = await go();
    setBusy(false);
    if (!r.ok) window.alert(r.message ?? "That didn't go through.");
    router.refresh();
  };
  if (!on)
    return (
      <Button size="sm" disabled={busy} onClick={() => void act(() => staffSwitchOn(businessId, addOn))}>
        Switch on
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={() =>
        window.confirm(addOn === "voice" ? "End voice agents? Its phone number is released." : "End this add-on?") &&
        void act(() => staffEnd(businessId, addOn))
      }
    >
      End
    </Button>
  );
}

/** Staff: put a number set up by hand (Twilio, then imported into Vapi) on a business with voice agents. */
export function AttachNumber({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [e164, setE164] = useState("");
  const [vapiId, setVapiId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await staffAttachNumber(businessId, e164, vapiId);
        setBusy(false);
        if (!r.ok) window.alert(r.message ?? "That didn't go through.");
        else router.refresh();
      }}
    >
      <input
        value={e164}
        onChange={(e) => setE164(e.target.value)}
        placeholder="+614…"
        className="h-8 w-32 rounded border border-line px-2 text-[13px]"
      />
      <input
        value={vapiId}
        onChange={(e) => setVapiId(e.target.value)}
        placeholder="Vapi number id"
        className="h-8 w-44 rounded border border-line px-2 text-[13px]"
      />
      <Button size="sm" variant="secondary" disabled={busy || !e164}>
        Put number on
      </Button>
    </form>
  );
}
