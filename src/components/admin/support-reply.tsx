"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Staff: answer a business's support ticket, resolve it, or open it again (server/design-support.ts). */
export function SupportReply({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    })
      .then((res) => res.json() as Promise<{ ok: boolean; message?: string; emailed?: boolean }>)
      .catch(() => ({ ok: false, message: "That didn't go through.", emailed: false }));
    setBusy(false);
    if (!r.ok) return setSaid(r.message ?? "That didn't go through.");
    if (body.do === "reply") {
      setText("");
      setSaid(r.emailed ? "Sent, and emailed to them." : "Sent. Not emailed: they'll see it in RENUABL.");
    } else setSaid(null);
    router.refresh();
  };
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        placeholder="Reply as RENUABL support"
        aria-label="Reply as RENUABL support"
        className="block min-h-20 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-ink"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => void send({ do: "reply", text })}>
          Reply
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !text.trim()}
          onClick={() => void send({ do: "reply", text, resolve: true })}
        >
          Reply and resolve
        </Button>
        {resolved ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send({ do: "reopen" })}>
            Open again
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send({ do: "resolve" })}>
            Resolve
          </Button>
        )}
        {said && <span className="text-[13px] text-muted">{said}</span>}
      </div>
    </div>
  );
}
