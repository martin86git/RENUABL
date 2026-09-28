"use client";

import { Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { OFFER_HOURS, timeLeft } from "@/lib/domain/offers";
import { answerOffer } from "@/lib/services/accounts";

/** Accept or decline an offer before it runs out; then it goes to another partner. */
export function OfferActions({ offer }: { offer: { id: string; expiresAt: string } }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = timeLeft(offer.expiresAt, now);

  async function answer(action: "accept" | "decline") {
    setBusy(action);
    setProblem(null);
    const r = await answerOffer(offer.id, action);
    if (!r.ok) {
      setProblem(r.message ?? "That didn't go through. Try again.");
      setBusy(null);
      return;
    }
    if (action === "decline") router.push("/installer/jobs");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-[14px] text-warning">
        <Clock className="h-4 w-4" /> {left.expired ? "This offer has expired" : `${left.label} to accept`}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button size="lg" className="rounded-2xl" disabled={left.expired || busy !== null} onClick={() => void answer("accept")}>
          {busy === "accept" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Accept job"}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="rounded-2xl"
          disabled={left.expired || busy !== null}
          onClick={() => void answer("decline")}
        >
          {busy === "decline" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Decline"}
        </Button>
      </div>
      <p className="text-[12.5px] text-muted">
        You have {OFFER_HOURS} hours from the offer. If you don&apos;t accept in time, it goes to another partner. The customer&apos;s name
        and address show once you accept.
      </p>
      {problem && (
        <p className="text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
