"use client";

import { Camera, Check, FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { BILL_UPLOAD, type BillSummary } from "@/lib/domain/bill";
import { readEnergyBill } from "@/lib/services/consumer";

const kwh = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 1 });

/** Upload the latest electricity bill; RENUABL reads the usage and sizes the system from it. */
export function BillUpload({
  bill,
  address,
  onRead,
}: {
  bill: BillSummary | null;
  /** The home address entered, so the bill can be checked against it. */
  address?: string;
  onRead: (bill: BillSummary) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setReading(true);
    setError(null);
    const result = await readEnergyBill(file, address);
    setReading(false);
    if (result.ok) onRead(result.bill);
    else setError(result.message);
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void read(f);
  };
  const picker = (
    <>
      <input
        ref={input}
        type="file"
        accept={BILL_UPLOAD.types.join(",")}
        hidden
        aria-label="Upload your electricity bill"
        onChange={onPick}
      />
      {/* Opens the camera on phones: most people have a paper bill or one on another screen. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo of your bill"
        onChange={onPick}
      />
    </>
  );

  if (reading) {
    return (
      <div
        className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface px-5 py-5 shadow-[var(--shadow-soft)]"
        aria-live="polite"
      >
        <Loader2 className="h-7 w-7 shrink-0 animate-spin text-forest" strokeWidth={1.6} aria-hidden />
        <div>
          <p className="text-[15px] text-ink">Reading your bill…</p>
          <p className="text-[12.5px] text-muted">Working out how much power your home uses, and when.</p>
        </div>
      </div>
    );
  }

  if (bill) {
    return (
      <div className="rounded-[var(--radius-card)] bg-sage/50 px-5 py-4" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-white">
            <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-forest">
              {bill.sample ? "Sample bill used (preview)" : `We've read your ${bill.retailer ? `${bill.retailer} ` : ""}bill`}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-forest/80">
              Your home uses about <span className="font-medium">{kwh(bill.dailyUsageKwh)} kWh a day</span> (
              {bill.annualUsageKwh.toLocaleString("en-AU")} kWh a year
              {bill.annualSource === "period" ? `, from this ${bill.periodDays}-day bill` : ""}).
              {bill.usageRate ? ` You pay around ${Math.round(bill.usageRate * 100)}c per kWh.` : ""}
            </p>
            {bill.hasSolar && (
              <p className="mt-1 text-[12.5px] text-forest/80">
                It looks like you already have solar{bill.exportedDailyKwh ? ` (exporting about ${bill.exportedDailyKwh} kWh a day)` : ""}.
                Tell us about it below.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="tap-area shrink-0 text-[13px] text-forest underline-offset-4 hover:underline"
          >
            Replace
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
        {picker}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-5 py-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-4">
        <FileText className="mt-0.5 h-7 w-7 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
        <div>
          <p className="text-[15px] text-ink">Add your latest electricity bill</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            A clear photo or the PDF. We size your system to what your home actually uses, nothing more.
          </p>
        </div>
      </div>
      {/* Phones: take a photo first, upload a file (PDF or screenshot) as the other option. Desktop: upload. */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
        <Button onClick={() => camera.current?.click()}>
          <Camera className="h-4 w-4" strokeWidth={1.8} /> Take a photo
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" strokeWidth={1.8} /> Upload a file
        </Button>
      </div>
      <div className="mt-4 hidden lg:block">
        <Button onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" strokeWidth={1.8} /> Upload bill
        </Button>
      </div>
      <p className="mt-3 text-[12px] leading-snug text-muted lg:hidden">
        Photograph the page showing your usage and billing period, flat and in good light.
      </p>
      {error && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-[12px] text-muted">We only read your usage and prices. Your bill isn&apos;t stored.</p>
      {picker}
    </div>
  );
}
