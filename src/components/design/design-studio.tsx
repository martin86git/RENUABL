"use client";

import { withDatasheets, type Datasheets } from "@/lib/domain/design/datasheets";
import { loadDatasheets } from "@/lib/services/datasheets";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { Wordmark } from "@/components/ui/primitives";
import { batteryCatalogue, inverterCatalogue, panelCatalogue } from "@/lib/domain/design/catalogue";
import { MONTHLY_SUN } from "@/lib/domain/design/tilt";
import { DEFAULT_WORKSPACE, workspaceCatalogue, type Workspace } from "@/lib/domain/design/pricing";
import { postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { ROOF_IMAGE, designSummary, type DesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import { yieldPerKw } from "@/lib/domain/sunshine";
import type { Address } from "@/lib/domain/types";
import {
  loadRoofWork,
  loadWorkspace,
  rememberRoof,
  saveRoofWork,
  type DesignRoof,
  savedLabel,
  whereKept,
  costsHidden,
} from "@/lib/services/design-store";
import { loadJob, saveJob } from "@/lib/services/crm";
import { NEEDS_ACCOUNT, NO_DEAL, proposalScreen, publishFromDesigner } from "@/lib/services/proposals";
import { useChatWaiting } from "./chat-panel";
import { sendReply, unreadChanged } from "@/lib/services/chat";
import { DesignKeptNote, DesignRoofList, useDesignAccount } from "./design-account";
import { DesignToolHome } from "./design-tool-home";
import { DealNotes, ProposalSide, PutOnDeal } from "./designer-side";
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
/**
 * Opened inside a deal's design drawer (an iframe of this page), the deal is told when the design is saved or published,
 * so its system details fill in from it there and then, and whether there is work not yet saved. Same site only.
 */
function tellDeal(news: { saved?: boolean; unsaved?: boolean; fold?: boolean }) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ renuablDesign: news }, window.location.origin);
}

export function DesignStudio() {
  // Null until this device's last roof has been looked up, so the address box doesn't flash before a saved roof.
  const [ready, setReady] = useState(false);
  const [roof, setRoof] = useState<DesignRoof | null>(null);
  const [work, setWork] = useState<{ set: DesignSet; extras: DesignExtras } | null>(null);
  // The customer's job this roof is being designed for, when the designer was opened from one (/design/roof?job=…).
  const params = useSearchParams();
  const jobId = params.get("job");
  // A roof opened from the home is kept in the address (?at=lat,lng&address=…), so a reload opens it again.
  const at = params.get("at");
  const atAddress = params.get("address") ?? "";
  const router = useRouter();
  const [account] = useDesignAccount();
  // Bumped after publishing, so the Proposal view's timeline reads again.
  const [published, setPublished] = useState(0);
  const [theirs, setTheirs] = useState<{ jobId: string; address: string; lat: number; lng: number } | null>(null);
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
    if (next && !jobId)
      router.replace(`/design/roof?at=${next.lat.toFixed(6)},${next.lng.toFixed(6)}&address=${encodeURIComponent(next.address)}`, {
        scroll: false,
      });
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
        // A job's own address comes first; otherwise a roof named in the address. With neither, the home.
        const asked = jobId ? await loadJob(jobId) : null;
        const forJob =
          asked?.ok && asked.job.lat !== null && asked.job.lng !== null
            ? { address: asked.job.address, lat: asked.job.lat, lng: asked.job.lng }
            : null;
        const [lat, lng] = (at ?? "").split(",").map(Number);
        const named = !jobId && at && Number.isFinite(lat) && Number.isFinite(lng) ? { address: atAddress, lat, lng } : null;
        const last = forJob ?? named;
        const loaded = last ? await loadRoofWork(last, settings) : null;
        if (gone) return;
        if (asked?.ok && forJob) {
          setJob({ id: asked.job.id, customerId: asked.customer.id, customerName: asked.customer.name, lat: forJob.lat, lng: forJob.lng });
          rememberRoof(forJob);
        } else if (jobId) {
          setProblem(asked && !asked.ok ? asked.message : "That job has no address on the map yet. Add one on the customer's page.");
          // The deal has no place of its own, but its customer does: offered in one press (as Primero's).
          if (asked?.ok && asked.customer.lat !== null && asked.customer.lng !== null && asked.customer.address)
            setTheirs({ jobId: asked.job.id, address: asked.customer.address, lat: asked.customer.lat, lng: asked.customer.lng });
        }
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
    // The address read once, as the page opens; opening another roof changes it without reloading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // The business's own checked datasheets (Settings → Product datasheets): signed out there are none.
  const [sheets, setSheets] = useState<Datasheets | null>(null);
  useEffect(() => {
    void loadDatasheets().then((res) => res.ok && setSheets(res.datasheets));
  }, []);

  // What the designer offers: the products on the uploaded price lists, or our own range for a kind the lists don't carry,
  // each with the business's checked electrical figures ahead of RENUABL's own, so the string check can use them.
  const catalogue = useMemo(() => {
    const own = workspaceCatalogue(workspace);
    return {
      panels: withDatasheets(own.panels ?? panelCatalogue(), sheets?.panels),
      inverters: withDatasheets(own.inverters ?? inverterCatalogue(), sheets?.inverters),
      batteries: own.batteries ?? batteryCatalogue(),
    };
  }, [workspace, sheets]);

  // Whether the designer has changes that aren't saved: asked about before another roof replaces it.
  const unsaved = useRef(false);
  const noteUnsaved = useCallback((value: boolean) => {
    unsaved.current = value;
    tellDeal({ unsaved: value });
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
  const waiting = useChatWaiting(onJob?.id ?? null);
  const signedIn = Boolean(account?.signedIn && account.business);

  if (roof && work && image)
    return (
      <div className="theme-studio pb-10">
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
            if (!problem) tellDeal({ saved: true });
            // Designed for a customer's job: the job carries the quote's price, so the pipeline shows what it is worth.
            if (!problem && onJob && net !== null)
              void saveJob(onJob.id, { value: net, kw: designSummary(next.designs[next.primary] ?? next.designs[0]).kw });
            return problem;
          }}
          // Publish: the design has just been saved. With a deal, its proposal is worked out again from it on the server.
          // Without one there is no customer to send a proposal to, and signed out there is no business to send it from.
          onPublish={async () => {
            const res = onJob
              ? await publishFromDesigner(onJob.id)
              : (await whereKept().catch(() => "device")) === "account"
                ? NO_DEAL
                : NEEDS_ACCOUNT;
            tellDeal({ saved: true });
            setPublished((n) => n + 1);
            return res;
          }}
          noDeal={
            signedIn && !onJob ? (
              <PutOnDeal
                place={{ lat: roof.lat, lng: roof.lng, address: roof.address }}
                // The roof opens again from its deal, so Publish makes the deal's proposal.
                onAttached={(id) => router.push(`/design/roof?job=${encodeURIComponent(id)}`)}
              />
            ) : undefined
          }
          proposalHref={onJob ? proposalScreen(onJob.id) : null}
          waiting={waiting}
          jobId={onJob?.id}
          notes={onJob ? <DealNotes jobId={onJob.id} customerId={onJob.customerId} /> : null}
          proposal={
            onJob ? (
              <ProposalSide jobId={onJob.id} refresh={published} />
            ) : (
              <p className="rounded-lg border border-line bg-surface p-3 text-sm text-ink-2">
                {signedIn ? (
                  <>
                    Not on a deal yet. This site is saved to your business: put it on a deal from the{" "}
                    <Link href="/design/roof" className="font-medium text-ink underline underline-offset-4">
                      design home
                    </Link>
                    , and its proposal, chat and timeline show here.
                  </>
                ) : (
                  "Saved on this device. Sign in to your business to send proposals and talk to the customer."
                )}
              </p>
            )
          }
          customerName={onJob?.customerName.split(" ")[0]}
          onNote={
            onJob
              ? async (text) => {
                  const res = await sendReply(onJob.id, text);
                  if (!res.ok) return { ok: false, message: res.message };
                  unreadChanged();
                  return { ok: true, message: res.outcome };
                }
              : undefined
          }
          costsHidden={costsHidden()}
          savedLabel={kept}
          onUnsaved={noteUnsaved}
          bar={
            <>
              <Link href="/design" aria-label="RENUABL" className="studio-own-mark">
                <Wordmark className="text-[17px]" />
              </Link>
              <Link
                href="/design/roof"
                onClick={(e) => {
                  if (unsaved.current && !window.confirm("This design has changes that aren't saved. Leave it and lose them?"))
                    e.preventDefault();
                  else {
                    // The home, without a roof: the page's own state is cleared as the address changes.
                    setRoof(null);
                    setWork(null);
                  }
                }}
                className="shrink-0 rounded px-2 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                title="The design home: deals waiting for a design, and recent designs"
              >
                Design home
              </Link>
              {onJob && (
                // The customer's name opens their deal (1 Nov 2026, Martin, as Primero's): in the deal's own drawer it folds the
                // designer away to show the deal underneath; on its own it goes to the deal.
                <button
                  type="button"
                  onClick={() => {
                    if (window.parent !== window) return tellDeal({ fold: true });
                    if (unsaved.current && !window.confirm("This design has changes that aren't saved. Leave it and lose them?")) return;
                    router.push(`/design/deals/${onJob.id}`);
                  }}
                  className="inline-flex max-w-52 shrink-0 items-center gap-1.5 rounded-full bg-sun-line px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-105"
                  title="Open the deal"
                >
                  <span className="truncate">{onJob.customerName}</span>
                  <span className="shrink-0 text-white/80">· Open deal</span>
                </button>
              )}
              {/* Another roof, without leaving the designer. */}
              <div className="w-72 min-w-44 max-w-full shrink xl:w-80 2xl:w-96">
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

  if (signedIn)
    return (
      <div className="theme-studio">
        {problem && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
            <span>{problem}</span>
            {theirs && (
              <button
                type="button"
                onClick={async () => {
                  const res = await saveJob(theirs.jobId, { address: theirs.address, lat: theirs.lat, lng: theirs.lng });
                  if (res.ok) window.location.reload();
                  else setProblem(res.message);
                }}
                className="rounded-full bg-sun-line px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-105"
              >
                Design it at the customer&apos;s address: {theirs.address}
              </button>
            )}
          </div>
        )}
        {ready && <DesignToolHome onPick={pick} onOpen={open} />}
      </div>
    );

  return (
    <div className="theme-studio flex min-h-dvh flex-col">
      <header className="studio-own-mark flex h-16 items-center px-5 lg:px-10">
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
