"use client";

import { Camera, Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Disclosure } from "@/components/ui/controls";
import { Card, Eyebrow, StatRow } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { HANDOVER_PHOTOS, type HandoverDocument, type HandoverPhoto, type HandoverRecord } from "@/lib/domain/handover";
import { documentSrc, findRecord, photoSrc } from "@/lib/services/handover";

function Photo({ record, photo, label }: { record: HandoverRecord; photo: HandoverPhoto; label: string }) {
  const recordKey = record.key;
  const { id: photoId, path } = photo;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void photoSrc(recordKey, photoId, path).then((s) => {
      url = s;
      if (live) setSrc(s);
    });
    return () => {
      live = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [recordKey, photoId, path]);
  if (!src) return <span className="block aspect-square rounded-xl bg-surface-2" />;
  return (
    <Dialog.Root>
      <Dialog.Trigger className="block aspect-square overflow-hidden rounded-xl bg-surface-2" aria-label={`Open photo: ${label}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- private photos from our own route or this device */}
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80" />
        <Dialog.Content className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src={src} alt={label} className="max-h-[85dvh] max-w-full rounded-2xl object-contain" />
          <Dialog.Close
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DocumentLink({ record, file, label }: { record: HandoverRecord; file: HandoverDocument; label: string }) {
  const [href, setHref] = useState<string | null>(null);
  const recordKey = record.key;
  const { id, path } = file;
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void documentSrc(recordKey, id, path).then((s) => {
      url = s;
      if (live) setHref(s);
    });
    return () => {
      live = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [recordKey, id, path]);
  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="tap-area text-[13.5px] text-ink-2 underline underline-offset-4"
    >
      {label}
    </a>
  );
}

function Serials({ label, serials }: { label: string; serials: string[] }) {
  if (!serials.length) return null;
  return (
    <Disclosure title={`${label} · ${serials.length}`}>
      <ol className="columns-1 gap-6 font-mono text-[13px] text-ink-2 sm:columns-2">
        {serials.map((s, i) => (
          <li key={s} className="py-0.5">
            <span className="mr-2 text-muted">{i + 1}.</span>
            {s}
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

/**
 * The home's installation record: photos from each stage and every serial
 * number, from the partner's handover. Without a record link, the example
 * home's record, labelled as such.
 */
export function InstallationRecord({ recordKey, example }: { recordKey: string | null; example: HandoverRecord }) {
  const [state, setState] = useState<{ record: HandoverRecord; isExample: boolean } | "loading" | "missing">(
    recordKey ? "loading" : { record: example, isExample: true },
  );

  useEffect(() => {
    if (!recordKey) return;
    let live = true;
    void findRecord(recordKey).then((r) => {
      if (live) setState(r ? { record: r.record, isExample: false } : "missing");
    });
    return () => {
      live = false;
    };
  }, [recordKey]);

  if (state === "loading") {
    return (
      <p className="flex items-center gap-2 py-10 text-[15px] text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your installation record
      </p>
    );
  }
  if (state === "missing") {
    return (
      <Card className="p-6">
        <p className="text-[17px]">We couldn&apos;t find that installation record.</p>
        <p className="mt-1 text-[14px] text-muted">Check the link in your handover email, or message us and we&apos;ll send it again.</p>
      </Card>
    );
  }

  const { record, isExample } = state;
  const s = record.summary ?? {};
  const byCategory = HANDOVER_PHOTOS.flatMap((slot) =>
    slot.id === "array"
      ? Array.from({ length: record.arrays }, (_, i) => ({
          key: `array-${i + 1}`,
          label: `Array ${i + 1}`,
          photos: record.photos.filter((p) => p.category === "array" && p.array === i + 1),
        }))
      : [{ key: slot.id, label: slot.label, photos: record.photos.filter((p) => p.category === slot.id) }],
  );

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Your installation</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">Everything about your system, in one place.</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Photos from each stage and every serial number, from your installation partner&apos;s handover. Share it with anyone who works on
          your system later.
        </p>
      </div>
      {isExample && (
        <p className="rounded-2xl bg-sage/70 px-5 py-3 text-[13.5px] text-forest">
          This is an example record. Yours appears here after your installation partner hands over your system.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Card className="p-5 sm:p-6">
            <h2 className="text-[17px] font-medium">Installation photos</h2>
            {record.photos.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[14px] text-muted">
                <Camera className="h-4 w-4" /> Photos of your roof, arrays, inverter, switchboard and commissioning appear here.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {byCategory.flatMap((c) =>
                  c.photos.map((p, n) => (
                    <li key={p.id}>
                      <Photo record={record} photo={p} label={c.label} />
                      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">
                        {c.label}
                        {c.photos.length > 1 ? ` (${n + 1})` : ""}
                      </p>
                    </li>
                  )),
                )}
              </ul>
            )}
          </Card>
          {(record.documents ?? []).length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-[17px] font-medium">Documents</h2>
              <ul className="mt-3 divide-y divide-line">
                {Object.entries(
                  (record.documents ?? []).reduce<Record<string, HandoverDocument[]>>((acc, d) => {
                    (acc[d.docId] ??= []).push(d);
                    return acc;
                  }, {}),
                ).map(([docId, files]) => (
                  <li key={docId} className="py-3">
                    <p className="text-[15px] text-ink">{files[0].label ?? "Document"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {files.map((f, i) => (
                        <DocumentLink key={f.id} record={record} file={f} label={files.length > 1 ? `Page ${i + 1}` : "Open"} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(record.serials.panels.length > 0 || record.serials.inverter || record.serials.batteries.length > 0) && (
            <Card className="px-5 py-2 sm:px-6">
              <h2 className="pt-3 text-[17px] font-medium">Serial numbers</h2>
              <div className="divide-y divide-line">
                <Serials label="Panels" serials={record.serials.panels} />
                {record.serials.inverter && (
                  <StatRow label="Inverter" value={<span className="font-mono">{record.serials.inverter}</span>} />
                )}
                <Serials label="Battery modules" serials={record.serials.batteries} />
              </div>
            </Card>
          )}
        </div>
        <Card className="h-fit p-5 sm:p-6 lg:col-span-4">
          <h2 className="text-[17px] font-medium">Your system</h2>
          <div className="mt-2 divide-y divide-line">
            {s.system && <StatRow label="System" value={s.system} />}
            {s.address && <StatRow label="Home" value={s.address} />}
            {s.installer && <StatRow label="Installation partner" value={s.installer} />}
            {s.installedOn && /^\d{4}-\d{2}-\d{2}$/.test(s.installedOn) && (
              <StatRow label="Installed" value={formatDate(s.installedOn, { day: "numeric", month: "long", year: "numeric" })} />
            )}
            <StatRow label="Arrays" value={record.arrays} />
          </div>
        </Card>
      </div>
    </div>
  );
}
