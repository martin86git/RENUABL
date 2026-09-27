"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { CaptureButtons } from "@/components/ui/capture";
import { Button, cn } from "@/components/ui/primitives";
import type { ComplianceKind } from "@/lib/domain/compliance";
import { submitComplianceRenewal } from "@/lib/services/partners";
import { FIELD } from "./use-record";

/** Upload a renewed certificate or licence with its new expiry date. */
export function ComplianceRenewal({ kind, label }: { kind: ComplianceKind; label: string }) {
  const [open, setOpen] = useState(false);
  const [expires, setExpires] = useState("");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState(kind === "public-liability" ? "10000000" : "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="mt-3 flex items-center gap-2 text-[14px] text-positive">
        <CircleCheck className="h-4 w-4" /> Sent. We&apos;ll check it and update your record.
      </p>
    );
  }
  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
        Upload renewal
      </Button>
    );
  }

  async function send() {
    if (!file) return setProblem("Add the certificate: take a photo or upload the PDF.");
    setBusy(true);
    setProblem(null);
    const res = await submitComplianceRenewal({
      kind,
      expires,
      number: number.trim() || undefined,
      amount: Number(amount) || undefined,
      file,
    });
    setBusy(false);
    if (res.ok) setSent(true);
    else setProblem(res.message);
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line p-4">
      <label className="block">
        <span className="text-[13px] text-muted">New expiry date</span>
        <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={cn(FIELD, "mt-1.5")} />
      </label>
      {kind === "public-liability" ? (
        <label className="block">
          <span className="text-[13px] text-muted">Cover (at least $10 million)</span>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            className={cn(FIELD, "mt-1.5 tabular-nums")}
          />
        </label>
      ) : (
        <label className="block">
          <span className="text-[13px] text-muted">{label} number</span>
          <input value={number} maxLength={40} onChange={(e) => setNumber(e.target.value)} className={cn(FIELD, "mt-1.5")} />
        </label>
      )}
      <div>
        <CaptureButtons
          size="sm"
          photoLabel={file ? "Retake photo" : "Take a photo"}
          fileLabel="Upload a PDF"
          desktopLabel={file ? "Choose another file" : "Upload the certificate"}
          onFiles={(f) => setFile(f[0] ?? null)}
        />
        {file && <p className="mt-1.5 truncate text-[13px] text-ink-2">{file.name}</p>}
      </div>
      {problem && (
        <p className="text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:flex">
        <Button size="sm" onClick={() => void send()} disabled={busy || !expires}>
          Send for review
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
