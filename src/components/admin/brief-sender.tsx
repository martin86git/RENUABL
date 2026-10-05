"use client";

import { Check, Copy, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

const field =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-ink";

/** Staff: make a private brief link for a lead, then copy it or open this phone's messages with the text ready. */
export function BriefSender() {
  const [firstName, setFirstName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("Martin");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; sms: string; mobile: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, mobile, email, from }),
      });
      const r = (await res.json()) as { ok: boolean; link?: string; sms?: string; mobile?: string | null; message?: string };
      if (r.ok && r.link && r.sms) setMade({ link: r.link, sms: r.sms, mobile: r.mobile ?? null });
      else setProblem(r.message ?? "That didn't work. Please try again.");
    } catch {
      setProblem("That didn't work. Check your connection.");
    }
    setBusy(false);
  }

  if (made) {
    return (
      <div className="space-y-3 px-5 py-4">
        <p className="text-[14px]">Brief ready for {firstName}. Send this text from your phone:</p>
        <p className="rounded-xl bg-surface-2 p-3 text-[13.5px] leading-snug">{made.sms}</p>
        <div className="flex flex-wrap gap-2">
          {made.mobile && (
            <a
              href={`sms:${made.mobile}?&body=${encodeURIComponent(made.sms)}`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[14px] text-primary-ink"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> Open in Messages
            </a>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(made.sms).then(() => setCopied(true));
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy text"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMade(null);
              setCopied(false);
              setFirstName("");
              setMobile("");
              setEmail("");
            }}
          >
            Another lead
          </Button>
        </div>
        <p className="text-[12px] text-muted">
          The link is private to them: anyone with it can fill in the brief. It appears below as they go.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void create(e)} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-2">
      <input className={field} placeholder="Their name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      <input className={field} placeholder="Their mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
      <input className={field} placeholder="Their email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={field} placeholder="Your first name (in the text)" value={from} onChange={(e) => setFrom(e.target.value)} />
      {problem && (
        <p className="text-[13px] text-danger sm:col-span-2" role="alert">
          {problem}
        </p>
      )}
      <Button type="submit" className="sm:col-span-2" disabled={busy || !firstName.trim()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Make the brief link"}
      </Button>
    </form>
  );
}
