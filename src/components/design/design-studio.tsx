"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { Wordmark } from "@/components/ui/primitives";
import { batteryCatalogue, inverterCatalogue, panelCatalogue } from "@/lib/domain/design/catalogue";
import { MONTHLY_SUN } from "@/lib/domain/design/tilt";
import { DEFAULT_WORKSPACE, workspaceCatalogue, type Workspace } from "@/lib/domain/design/pricing";
import { postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import type { DesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import { yieldPerKw } from "@/lib/domain/sunshine";
import type { Address } from "@/lib/domain/types";
import { loadLastRoof, loadRoofWork, loadWorkspace, rememberRoof, saveRoofWork, type DesignRoof } from "@/lib/services/design-store";
import { DesignAccountLink, DesignKeptNote, DesignRoofList } from "./design-account";
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
 * The roof designer as a page of its own (/design): an address first, then the
 * designer on that roof. Designs are kept for the signed-in business, or on this device when nobody is signed in
 * (`design-store.ts`).
 */
export function DesignStudio() {
  // Null until this device's last roof has been looked up, so the address box doesn't flash before a saved roof.
  const [ready, setReady] = useState(false);
  const [roof, setRoof] = useState<DesignRoof | null>(null);
  const [work, setWork] = useState<{ set: DesignSet; extras: DesignExtras } | null>(null);
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
  // Whether the roof's picture came: without it the designer still opens, on a plain backdrop, and says so.
  const [pictureMissing, setPictureMissing] = useState(false);
  const image = roof ? `/api/design/roof?lat=${roof.lat.toFixed(6)}&lng=${roof.lng.toFixed(6)}` : null;
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
        const last = loadLastRoof();
        const loaded = last ? await loadRoofWork(last, settings) : null;
        if (gone) return;
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
  }, []);

  // What the designer offers: the products on the uploaded price lists, or our own range for a kind the lists don't carry.
  const catalogue = useMemo(() => {
    const own = workspaceCatalogue(workspace);
    return {
      panels: own.panels ?? panelCatalogue(),
      inverters: own.inverters ?? inverterCatalogue(),
      batteries: own.batteries ?? batteryCatalogue(),
    };
  }, [workspace]);

  const pick = (address: Address) => {
    if (typeof address.lat !== "number" || typeof address.lng !== "number")
      return setProblem(
        "We couldn't place that address on the map. Pick the street address from the list as you type. If no list appears, the address search isn't connected here (it needs GOOGLE_MAPS_API_KEY).",
      );
    setProblem(null);
    open({
      address: [address.line, address.suburb, address.state, address.postcode].filter(Boolean).join(", "),
      lat: address.lat,
      lng: address.lng,
    });
  };

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
          onSave={async (next, extras) => saveRoofWork(roof, next, extras)}
          bar={
            <Link href="/" aria-label="RENUABL home">
              <Wordmark className="text-[17px]" />
            </Link>
          }
          back={
            <>
              <Link
                href="/design/settings"
                className="tap-area shrink-0 text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                Prices and settings
              </Link>
              <DesignAccountLink />
              <button
                onClick={() => open(null)}
                className="tap-area shrink-0 text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                Change address
              </button>
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
        <Link href="/" aria-label="RENUABL home">
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
