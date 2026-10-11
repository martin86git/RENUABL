"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { Wordmark } from "@/components/ui/primitives";
import { batteryCatalogue, inverterCatalogue, panelCatalogue } from "@/lib/domain/design/catalogue";
import { MONTHLY_SUN } from "@/lib/domain/design/tilt";
import { DEFAULT_WORKSPACE, workspaceCatalogue, type Workspace } from "@/lib/domain/design/pricing";
import { postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { ROOF_IMAGE, type DesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import { yieldPerKw } from "@/lib/domain/sunshine";
import type { Address } from "@/lib/domain/types";
import {
  loadLastRoof,
  loadRoofWork,
  loadWorkspace,
  rememberRoof,
  saveRoofWork,
  type DesignRoof,
  savedLabel,
  whereKept,
} from "@/lib/services/design-store";
import { loadJob, saveJob } from "@/lib/services/crm";
import { NEEDS_ACCOUNT, NO_DEAL, proposalScreen, publishFromDesigner } from "@/lib/services/proposals";
import { DesignKeptNote, DesignRoofList } from "./design-account";
import { RoofDesigner } from "./roof-designer";

/** What a kilowatt of panels makes in a day, from the same sunshine record the designer's months use. */
const YIELD_PER_KW_DAY = yieldPerKw({ annual: MONTHLY_SUN.reduce((n, m) => n + m, 0) / 12 });

const CANT_OPEN = "We couldn't open your saved work. Check your connection and reload the page.";

const STEPS = [
  ["Find the roof", "Enter the address and see the roof from above, to scale."],
  ["Lay out the panels", "Trace each roof face and panels fill it in rows, or place and turn them one at a time."],
  ["Check the wiring", "String the panels up and see each string checked against the inverter's limits."],
] as const;

/**
 * The design tool (/design/roof): an address first, then the
 * designer on that roof. Designs are kept for the signed-in business, or on this device when nobody is signed in
 * (`design-store.ts`).
 */
export function DesignStudio() {
  // Null until this device's last roof has been looked up, so the address box doesn't flash before a saved roof.
  const [ready, setReady] = useState(false);
  const [roof, setRoof] = useState<DesignRoof | null>(null);
  const [work, setWork] = useState<{ set: DesignSet; extras: DesignExtras } | null>(null);
  // The customer's job this roof is being designed for, when the designer was opened from one (/design/roof?job=…).
  const jobId = useSearchParams().get("job");
  const [job, setJob] = useState<{ id: string; customerId: string; customerName: string; lat: number; lng: number } | null>(null);
  // The business's price lists and settings; and the STC rules, today's when they can be had.
  const [workspace, setWorkspace] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [rates, setRates] = useState<RebateRates>(VERIFIED_RATES);
  useEffect(() => {
    const stop = new AbortController();
    fetch("/api/rebates", { signal: stop.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { rates?: RebateRates } | null) => {
        if (json?.rates?.stc) setRates(json.rates);
      })
      .catch(() => {
        // The hand-checked rules stand in.
      });
    return () => stop.abort();
  }, []);
  const [problem, setProblem] = useState<string | null>(null);
  // Where saved work is kept (this device, or the business's account), for the designer's "Saved" line.
  const [kept, setKept] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void savedLabel().then((label) => live && setKept(label));
    return () => {
      live = false;
    };
  }, []);
  // Whether the roof's picture came: without it the designer still opens, on a plain backdrop, and says so.
  const [pictureMissing, setPictureMissing] = useState(false);
  // The picture's shape is part of its address, so a browser never shows one it kept from before the shape changed.
  const image = roof
    ? `/api/design/roof?lat=${roof.lat.toFixed(6)}&lng=${roof.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
    : null;
  useEffect(() => {
    if (!image) return;
    const probe = new Image();
    probe.onload = () => setPictureMissing(false);
    probe.onerror = () => setPictureMissing(true);
    probe.src = image;
    return () => {
      probe.onload = probe.onerror = null;
    };
  }, [image]);

  const open = (next: DesignRoof | null) => {
    setProblem(null);
    rememberRoof(next);
    if (!next) {
      setRoof(null);
      setWork(null);
      return;
    }
    // The roof opens once its saved work has arrived. If it can't be fetched, say so rather than show an empty roof.
    loadRoofWork(next, workspace).then(
      (loaded) => {
        setRoof(next);
        setWork(loaded);
      },
      (e: unknown) => setProblem(e instanceof Error ? e.message : CANT_OPEN),
    );
  };

  useEffect(() => {
    // The settings and the roof last opened on this device, from the account or this device's storage.
    let gone = false;
    void (async () => {
      try {
        const settings = await loadWorkspace();
        // A job's own address comes first; otherwise the roof last opened.
        const asked = jobId ? await loadJob(jobId) : null;
        const forJob =
          asked?.ok && asked.job.lat !== null && asked.job.lng !== null
            ? { address: asked.job.address, lat: asked.job.lat, lng: asked.job.lng }
            : null;
        const last = forJob ?? loadLastRoof();
        const loaded = last ? await loadRoofWork(last, settings) : null;
        if (gone) return;
        if (asked?.ok && forJob) {
          setJob({ id: asked.job.id, customerId: asked.customer.id, customerName: asked.customer.name, lat: forJob.lat, lng: forJob.lng });
          rememberRoof(forJob);
        } else if (jobId)
          setProblem(asked && !asked.ok ? asked.message : "That job has no address on the map yet. Add one on the customer's page.");
        setWorkspace(settings);
        if (last && loaded) {
          setRoof(last);
          setWork(loaded);
        }
      } catch (e) {
        if (!gone) setProblem(e instanceof Error ? e.message : CANT_OPEN);
      }
      if (!gone) setReady(true);
    })();
    return () => {
      gone = true;
    };
  }, [jobId]);

  // What the designer offers: the products on the uploaded price lists, or our own range for a kind the lists don't carry.
  const catalogue = useMemo(() => {
    const own = workspaceCatalogue(workspace);
    return {
      panels: own.panels ?? panelCatalogue(),
      inverters: own.inverters ?? inverterCatalogue(),
      batteries: own.batteries ?? batteryCatalogue(),
    };
  }, [workspace]);

  // Whether the designer has changes that aren't saved: asked about before another roof replaces it.
  const unsaved = useRef(false);
  const noteUnsaved = useCallback((value: boolean) => {
    unsaved.current = value;
  }, []);

  const pick = (address: Address) => {
    if (typeof address.lat !== "number" || typeof address.lng !== "number")
      return setProblem(
        "We couldn't place that address on the map. Pick the street address from the list as you type. If no list appears, the address search isn't connected here (it needs GOOGLE_MAPS_API_KEY).",
      );
    if (unsaved.current && !window.confirm("This design has changes that aren't saved. Open the other address and lose them?")) return;
    unsaved.current = false;
    setProblem(null);
    open({
      address: [address.line, address.suburb, address.state, address.postcode].filter(Boolean).join(", "),
      lat: address.lat,
      lng: address.lng,
    });
  };

  // The job only counts while its own roof is the one open.
  const onJob = job && roof && job.lat === roof.lat && job.lng === roof.lng ? job : null;

  if (roof && work && image)
    return (
      <div className="theme-studio min-h-dvh px-4 pb-20 sm:px-6 lg:px-8">
        <RoofDesigner
          // A different roof is a different designer: nothing from the last one carries over.
          key={`${roof.lat},${roof.lng}`}
          address={roof.address}
          image={pictureMissing ? "" : image}
          set={work.set}
          extras={work.extras}
          workspace={workspace}
          rates={rates}
          postcode={postcodeIn(roof.address)}
          catalogue={catalogue.panels}
          inverters={catalogue.inverters}
          batteries={catalogue.batteries}
          yieldPerKwDay={YIELD_PER_KW_DAY}
          onSave={async (next, extras, net) => {
            const problem = await saveRoofWork(roof, next, extras);
            // Designed for a customer's job: the job carries the quote's price, so the pipeline shows what it is worth.
            if (!problem && onJob && net !== null) void saveJob(onJob.id, { value: net });
            return problem;
          }}
          // Publish: the design has just been saved. With a deal, its proposal is worked out again from it on the server.
          // Without one there is no customer to send a proposal to, and signed out there is no business to send it from.
          onPublish={async () =>
            onJob ? publishFromDesigner(onJob.id) : (await whereKept().catch(() => "device")) === "account" ? NO_DEAL : NEEDS_ACCOUNT
          }
          proposalHref={onJob ? proposalScreen(onJob.id) : null}
          savedLabel={kept}
          onUnsaved={noteUnsaved}
          bar={
            <>
              <Link href="/design" aria-label="RENUABL">
                <Wordmark className="text-[17px]" />
              </Link>
              {onJob && (
                <Link
                  href={`/design/customers/${onJob.customerId}`}
                  className="max-w-40 shrink-0 truncate rounded bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-sage"
                  title="Back to this customer"
                >
                  {onJob.customerName}
                </Link>
              )}
              {/* Another roof, without leaving the designer. */}
              <div className="w-72 max-w-full shrink-0 xl:w-96 2xl:w-[30rem]">
                <AddressEntry compact placeholder="Search another address" onPick={pick} />
              </div>
            </>
          }
        />
        {pictureMissing && (
          <p className="mx-auto mt-4 max-w-3xl rounded-lg bg-warning-soft px-5 py-3 text-center text-[13.5px] text-warning" role="status">
            The picture of this roof couldn&apos;t be loaded, so there is nothing to trace yet. Try again in a moment, or change the
            address.
          </p>
        )}
        <p className="mx-auto mt-8 max-w-3xl text-center text-[13px] leading-relaxed text-muted">
          A design aid. Output figures are rough: they leave out shade and aren&apos;t a site inspection. String checks don&apos;t replace
          the installer&apos;s own design check or the manufacturer&apos;s sizing tool.
        </p>
      </div>
    );

  return (
    <div className="theme-studio flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 lg:px-10">
        <Link href="/design" aria-label="RENUABL">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-20 pt-10 lg:pt-20">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-forest">Roof designer</p>
        <h1 className="mt-3 text-[34px] leading-[1.08] tracking-tight text-ink sm:text-[46px]">Lay out solar panels on any roof.</h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">
          See the roof from above, place the panels, and check the strings against the inverter.
        </p>
        {ready && (
          <>
            <AddressEntry className="mt-8" onPick={pick} />
            {problem && (
              <p className="mt-2 pl-5 text-[13px] text-danger" role="alert">
                {problem}
              </p>
            )}
            <DesignRoofList onOpen={open} />
          </>
        )}
        <ol className="mt-12 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line">
              <span className="grid size-7 place-items-center rounded-full border border-sun-line text-[13px] text-sun-line-ink">
                {i + 1}
              </span>
              <p className="mt-3 text-[15px] font-medium text-ink">{title}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[13px] leading-relaxed text-muted">
          <DesignKeptNote /> It works best on a computer with a mouse.{" "}
          <Link href="/design/settings" className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
            Set up your price lists and rates
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
