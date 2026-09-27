"use client";

import { Camera, Check, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { describeInverter, type InverterSummary } from "@/lib/domain/inverter";
import { readInverterPhotos } from "@/lib/services/consumer";

const SHOTS = [
  {
    key: "front",
    title: "The front of your inverter",
    hint: "The box your solar panels connect to, usually on a wall near your switchboard or in the garage.",
  },
  {
    key: "label",
    title: "The sticker on its side",
    hint: "The label with the model and serial number. It usually has a barcode. Get close so the writing is sharp.",
  },
] as const;

/** Optional: photos of the existing inverter so we can check it works with a battery before the call. */
export function InverterPhotos({ inverter, onRead }: { inverter: InverterSummary | null; onRead: (i: InverterSummary) => void }) {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function choose(key: string, file: File) {
    setFiles((f) => ({ ...f, [key]: file }));
    setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
    setMessage(null);
  }

  async function read() {
    const chosen = Object.values(files).filter((f): f is File => Boolean(f));
    if (chosen.length === 0) return;
    setBusy(true);
    const result = await readInverterPhotos(chosen);
    setBusy(false);
    if (result.ok) onRead(result.inverter);
    else setMessage(result.message);
  }

  if (inverter) {
    return (
      <p
        className="mt-3 flex items-start gap-2.5 rounded-xl bg-sage/50 px-3.5 py-3 text-[12.5px] leading-snug text-forest"
        aria-live="polite"
      >
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        <span>
          {inverter.sample ? "Sample inverter (preview): " : "We've read your inverter: "}
          <span className="font-medium">{describeInverter(inverter)}</span>. We&apos;ll confirm it works with your new battery on the call.
        </span>
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-canvas px-3.5 py-3">
      <p className="text-[13px] text-ink">Save time on your call: add photos of your inverter</p>
      <p className="text-[12px] leading-snug text-muted">Optional. It helps us check your system works with a battery.</p>
      <ul className="mt-3 space-y-2.5">
        {SHOTS.map((shot) => (
          <li key={shot.key} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputs.current[shot.key]?.click()}
              aria-label={files[shot.key] ? `Replace photo: ${shot.title}` : `Add photo: ${shot.title}`}
              className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface text-ink-2 hover:text-ink"
            >
              {previews[shot.key] ? (
                <Image src={previews[shot.key]} alt="" fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <Camera className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">{shot.title}</p>
              <p className="text-[11.5px] leading-snug text-muted">{shot.hint}</p>
            </div>
            {files[shot.key] && (
              <button
                type="button"
                aria-label={`Remove photo: ${shot.title}`}
                onClick={() => {
                  setFiles((f) => ({ ...f, [shot.key]: undefined }));
                  setPreviews(({ [shot.key]: _gone, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <input
              ref={(el) => {
                inputs.current[shot.key] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) choose(shot.key, f);
              }}
            />
          </li>
        ))}
      </ul>
      {Object.values(files).some(Boolean) && (
        <Button size="sm" className="mt-3" disabled={busy} onClick={() => void read()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Read my inverter"}
        </Button>
      )}
      {message && (
        <p className="mt-2 text-[12.5px] text-ink-2" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
