"use client";

import { withDatasheets, type Datasheets } from "@/lib/domain/design/datasheets";
import { findDatasheetOnline, loadDatasheets } from "@/lib/services/datasheets";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DesignBrief } from "./design-brief";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { Wordmark } from "@/components/ui/primitives";
import { batteryCatalogue, inverterCatalogue, panelCatalogue } from "@/lib/domain/design/catalogue";
import { MONTHLY_SUN } from "@/lib/domain/design/tilt";
import { DEFAULT_WORKSPACE, chargerCatalogue, workspaceCatalogue, type Workspace } from "@/lib/domain/design/pricing";
import { postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { cleanKind } from "@/lib/domain/design/business-kind";
import { ROOF_IMAGE, designSummary, type DesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import { yieldPerKw } from "@/lib/domain/sunshine";
import type { Address } from "@/lib/domain/types";
import {
  dropDraft,
  keepDraft,
  loadDraft,
  loadRoofWork,
  loadWorkspace,
  rememberRoof,
  saveRoofWork,
  type DesignRoof,
  savedLabel,
  whereKept,
  costsHidden,
} from "@/lib/services/design-store";
import { createCustomer, loadJob, saveJob } from "@/lib/services/crm";
import { AddressStrip, type NewDealInput } from "./address-strip";
import { onStreetWords } from "@/lib/domain/address";
import { CREDITS_EVENT, DesignCredits } from "./design-credits";
import { NEEDS_ACCOUNT, NO_DEAL, proposalScreen, publishFromDesigner } from "@/lib/services/proposals";
import { useChatWaiting } from "./chat-panel";
import { sendReply, unreadChanged } from "@/lib/services/chat";
import { DesignKeptNote, DesignRoofList, useDesignAccount } from "./design-account";
import { DesignToolHome } from "./design-tool-home";
import { goUnderneath, inDrawer, openDesigner, useInDrawer } from "./design-drawer";
import { DealNotes, ProposalSide, PutOnDeal } from "./designer-side";
import { PictureMenu } from "./picture-menu";
import { fetchNearmap, loadImagery, nearmapPictureHref, type RoofImagery } from "@/lib/services/nearmap";
import { capturedWords } from "@/lib/domain/design/nearmap";
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
function tellDeal(news: { saved?: boolean; unsaved?: boolean; fold?: boolean; job?: string; proposal?: boolean }) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ renuablDesign: news }, window.location.origin);
}

interface RoofOpen {
  set: DesignSet;
  extras: DesignExtras;
  /** When the draft it opens on was kept; null when it opens on what is saved. */
  draftAt: string | null;
  saved: { set: DesignSet; extras: DesignExtras };
}

/** A roof's saved work, and this person's draft of it when one is still drawn over it (`design-store.ts`). */
async function loadWithDraft(roof: DesignRoof, workspace: Workspace): Promise<RoofOpen> {
  const saved = await loadRoofWork(roof, workspace);
  const draft = await loadDraft(roof, workspace).catch(() => null);
  return draft ? { set: draft.set, extras: draft.extras, draftAt: draft.at, saved } : { ...saved, draftAt: null, saved };
}

export function DesignStudio() {
  // Null until this device's last roof has been looked up, so the address box doesn't flash before a saved roof.
  // Inside the designer pop-up: the bar is trimmed and the picture sized to the window.
  const popped = useInDrawer();
  const [ready, setReady] = useState(false);
  const [roof, setRoof] = useState<DesignRoof | null>(null);
  // The work the designer opens on: a draft kept from an earlier visit when there is one still drawn over the saved roof
  // (`draftAt` says when it was kept), with what is saved beside it for Discard.
  const [work, setWork] = useState<RoofOpen | null>(null);
  // Bumped when a draft is thrown away, so the designer opens afresh on what is saved.
  const [fresh, setFresh] = useState(0);
  // The customer's job this roof is being designed for, when the designer was opened from one (/design/roof?job=…).
  const params = useSearchParams();
  const jobId = params.get("job");
  // Sol's design request from the deal's team chat, shown as a brief over the designer (?ask=…).
  const askId = params.get("ask");
  // A roof opened from the home is kept in the address (?at=lat,lng&address=…), so a reload opens it again.
  const at = params.get("at");
  const atAddress = params.get("address") ?? "";
  const router = useRouter();
  const [account] = useDesignAccount();
  // Bumped after publishing, so the Proposal view's timeline reads again.
  const [published, setPublished] = useState(0);
  const [theirs, setTheirs] = useState<{ jobId: string; address: string; lat: number; lng: number } | null>(null);
  // A deal opened in the designer with no place on the map (18 Nov 2026, Martin: the warning named no one and Sol's
  // brief for it floated over the other deals): its customer, so the address can be found for it here.
  const [noPlace, setNoPlace] = useState<{ jobId: string; name: string; typed: string } | null>(null);
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
  // An address Google could only put on its street (18 Nov 2026, Martin: a house number that doesn't exist opened on the
  // middle of the court), and the deal whose roof was just moved to another address, to ask whether the deal moves too.
  const [onStreet, setOnStreet] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ jobId: string; name: string; address: string; lat: number; lng: number } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
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
  // Which picture the roof uses, Google's or a Nearmap capture the business kept (3 Nov 2026): signed in only.
  const business = Boolean(account?.signedIn && account.business);
  const spot = roof ? `${roof.lat.toFixed(6)},${roof.lng.toFixed(6)}` : null;
  const [imagery, setImagery] = useState<{ spot: string; value: RoofImagery } | null>(null);
  useEffect(() => {
    if (!roof || !spot || !business) return;
    let live = true;
    void loadImagery(roof.lat, roof.lng).then(async (res) => {
      if (!live || !res.ok) return;
      setImagery({ spot, value: res });
      // A roof seen for the first time opens on Nearmap's newest picture where it has one (10 Nov 2026, Martin): its
      // heights read the roof's faces. Fetched once and kept; a roof set back to Google by hand stays on Google.
      if (!res.ready || res.use !== "google" || res.kept.length) return;
      const got = await fetchNearmap(roof.lat, roof.lng);
      if (live && got.ok) setImagery({ spot, value: { ...res, use: got.use, kept: got.kept } });
    });
    return () => {
      live = false;
    };
  }, [roof, spot, business]);
  const roofImagery = imagery && imagery.spot === spot ? imagery.value : null;
  const nearmapKept = roofImagery && roofImagery.use !== "google" ? roofImagery.kept.find((k) => k.survey === roofImagery.use) : undefined;
  // The picture's shape is part of its address, so a browser never shows one it kept from before the shape changed.
  const image = roof
    ? roofImagery && roofImagery.use !== "google"
      ? nearmapPictureHref(roof.lat, roof.lng, roofImagery.use)
      : `/api/design/roof?lat=${roof.lat.toFixed(6)}&lng=${roof.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
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
    loadWithDraft(next, workspace).then(
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
        const loaded = last ? await loadWithDraft(last, settings) : null;
        if (gone) return;
        if (asked?.ok && forJob) {
          setJob({ id: asked.job.id, customerId: asked.customer.id, customerName: asked.customer.name, lat: forJob.lat, lng: forJob.lng });
          rememberRoof(forJob);
        } else if (jobId) {
          if (asked?.ok)
            setNoPlace({ jobId: asked.job.id, name: asked.customer.name, typed: asked.job.address || asked.customer.address || "" });
          else setProblem(asked ? asked.message : "That deal couldn't be opened.");
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
      // EV chargers only ever come from the business's own lists: RENUABL has no range of its own to offer.
      chargers: chargerCatalogue(workspace),
    };
  }, [workspace, sheets]);

  // Whether the designer has changes that aren't saved: asked about before another roof replaces it.
  const unsaved = useRef(false);
  const noteUnsaved = useCallback((value: boolean) => {
    unsaved.current = value;
    tellDeal({ unsaved: value });
  }, []);

  /** From the design home, a roof slides over it in the design drawer (the home stays underneath). */
  const openOver = (next: DesignRoof) =>
    openDesigner(`/design/roof?at=${next.lat.toFixed(6)},${next.lng.toFixed(6)}&address=${encodeURIComponent(next.address)}`, router, () =>
      open(next),
    );

  const pick = (address: Address) => {
    if (typeof address.lat !== "number" || typeof address.lng !== "number")
      return setProblem(
        "We couldn't place that address on the map. Pick the street address from the list as you type. If no list appears, the address search isn't connected here (it needs GOOGLE_MAPS_API_KEY).",
      );
    if (unsaved.current && !window.confirm("This design has changes that aren't saved. Open the other address and lose them?")) return;
    unsaved.current = false;
    setProblem(null);
    const next = {
      address: [address.line, address.suburb, address.state, address.postcode].filter(Boolean).join(", "),
      lat: address.lat,
      lng: address.lng,
    };
    setOnStreet(address.approximate ? onStreetWords(address) : null);
    // A deal's roof opened somewhere else: Sol asks whether the deal's address should follow (18 Nov 2026, Martin).
    setMoving(null);
    setMoved(
      onJob && (onJob.lat !== next.lat || onJob.lng !== next.lng)
        ? { jobId: onJob.id, name: onJob.customerName.split(" ")[0] || onJob.customerName, ...next }
        : null,
    );
    if (roof || jobId) open(next);
    else openOver(next);
  };

  // The job only counts while its own roof is the one open.
  const onJob = job && roof && job.lat === roof.lat && job.lng === roof.lng ? job : null;
  const waiting = useChatWaiting(onJob?.id ?? null);
  // The window round the designer learns the deal this roof is on, however it was opened (by its address from the design
  // home too), so its tools beside the window (Record, the proposal) show (16 Nov 2026, Martin: no Record on a deal's roof).
  const onJobId = onJob?.id ?? null;
  // The designer opened for a deal, but the roof open is somewhere else (18 Nov 2026, Martin: the deal's address landed on
  // the street, the house next to it was designed, and the proposal then found no design; a failed demo). The deal stays
  // the one in hand: it is asked whether it moves here for as long as that is so, Create deal becomes Put it on the deal,
  // and Proceed to proposal puts it there first.
  const stray =
    job && roof && !onJob
      ? { jobId: job.id, name: job.customerName.split(" ")[0] || job.customerName, address: roof.address, lat: roof.lat, lng: roof.lng }
      : null;
  const strayKey = stray ? `${stray.jobId}@${stray.lat},${stray.lng}` : null;
  const [strayNo, setStrayNo] = useState<string | null>(null);
  const putOnDeal = async (then?: "proposal"): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!stray) return { ok: false, message: "This roof is already on its deal." };
    window.dispatchEvent(new Event("renuabl:design-save"));
    const res = await saveJob(stray.jobId, { address: stray.address, lat: stray.lat, lng: stray.lng });
    if (!res.ok) return { ok: false, message: res.message };
    setJob((j) => (j && j.id === stray.jobId ? { ...j, lat: stray.lat, lng: stray.lng } : j));
    setMoved(null);
    tellDeal({ job: stray.jobId, saved: true });
    // On to the proposal once the design has had a moment to save and join the deal.
    if (then === "proposal")
      window.setTimeout(() => {
        if (inDrawer()) tellDeal({ proposal: true });
        else router.push(`/design/deals/${encodeURIComponent(stray.jobId)}/proposal`);
      }, 1500);
    return { ok: true };
  };
  useEffect(() => {
    if (onJobId && inDrawer()) tellDeal({ job: onJobId });
  }, [onJobId]);
  const signedIn = Boolean(account?.signedIn && account.business);

  /**
   * Create deal from the address strip (16 Nov 2026, Martin): a customer and their first deal at this roof's address, made
   * where the designer is, nothing navigated. The design is saved, so the deal finds this roof (its design joins it),
   * and the pop-up is told the deal, so its tools (Record, the proposal) are there at once.
   */
  // A deal can be made here by a signed-in retailer who sees costs; Proceed to proposal on a roof with none asks for one.
  const canMakeDeal = signedIn && !costsHidden() && cleanKind(account?.signedIn ? account.business?.kind : undefined) === "retailer";
  const [dealAsk, setDealAsk] = useState(0);
  // Raised to open the address search under the picture (Sol's "Is this the home?" answered no).
  const [searchAsk, setSearchAsk] = useState(0);
  // Run once the design is next saved (going on to the proposal after a deal is made for it).
  const afterSave = useRef<(() => void) | null>(null);
  const createDealHere = async (input: NewDealInput): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!roof) return { ok: false, message: "Open an address first." };
    const res = await createCustomer({
      name: [input.firstName, input.lastName].filter(Boolean).join(" "),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      address: roof.address,
      lat: roof.lat,
      lng: roof.lng,
      source: "Design tool",
      notes: "",
      owner: input.owner || null,
    });
    if (!res.ok) return { ok: false, message: res.message };
    if (!res.job) return { ok: false, message: "The customer was kept, but their deal couldn't be made: add it from their page." };
    // Asked from Proceed to proposal: on to the proposal once the design is saved (or after a moment, when there was
    // nothing new to save).
    const made = res.job;
    if (dealAsk > 0) {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        afterSave.current = null;
        if (inDrawer()) tellDeal({ proposal: true });
        else router.push(`/design/deals/${encodeURIComponent(made.id)}/proposal`);
      };
      afterSave.current = go;
      window.setTimeout(go, 2500);
    }
    window.dispatchEvent(new Event("renuabl:design-save"));
    setJob({ id: res.job.id, customerId: res.customer.id, customerName: res.customer.name, lat: roof.lat, lng: roof.lng });
    tellDeal({ job: res.job.id, saved: true });
    return { ok: true };
  };

  if (roof && work && image)
    return (
      <div className={popped ? "theme-studio" : "theme-studio pb-10"}>
        {jobId && askId && <DesignBrief jobId={jobId} askId={askId} />}
        {onStreet && (
          <div className="mb-2 flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
            <span className="flex-1">{onStreet}</span>
            <button type="button" onClick={() => setOnStreet(null)} className="text-[12px] font-medium underline underline-offset-2">
              Dismiss
            </button>
          </div>
        )}
        {(moved ?? (stray && strayNo !== strayKey ? stray : null)) && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-ink" role="status">
            <span className="min-w-0 flex-1">
              {moving ?? (
                <>
                  Update the address on {(moved ?? stray)!.name}&apos;s deal to{" "}
                  <strong className="font-semibold">{(moved ?? stray)!.address}</strong>?
                </>
              )}
            </span>
            {!moving && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    const it = (moved ?? stray)!;
                    setMoving("Updating the deal…");
                    const res = await saveJob(it.jobId, { address: it.address, lat: it.lat, lng: it.lng });
                    if (!res.ok) return setMoving(res.message);
                    // The roof open now is the deal's own again, so its tools (proposal, chat, Record) follow it.
                    window.dispatchEvent(new Event("renuabl:design-save"));
                    setJob((j) => (j && j.id === it.jobId ? { ...j, lat: it.lat, lng: it.lng } : j));
                    tellDeal({ job: it.jobId, saved: true });
                    setMoving(`Done: ${it.name}'s deal is at ${it.address}.`);
                    window.setTimeout(() => {
                      setMoved(null);
                      setMoving(null);
                    }, 2500);
                  }}
                  className="rounded-full bg-sun-line px-3 py-1 text-[13px] font-medium text-white hover:brightness-105"
                >
                  Yes, update it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoved(null);
                    setStrayNo(strayKey);
                  }}
                  className="rounded-full px-3 py-1 text-[13px] font-medium ring-1 ring-white/30 hover:bg-white/10"
                >
                  No
                </button>
              </>
            )}
          </div>
        )}
        <RoofDesigner
          // A different roof is a different designer: nothing from the last one carries over.
          key={`${roof.lat},${roof.lng},${fresh}`}
          address={roof.address}
          onPickAddress={pick}
          onAddressDoubt={setOnStreet}
          onSearchAddress={popped ? () => setSearchAsk((n) => n + 1) : undefined}
          image={pictureMissing ? "" : image}
          set={work.set}
          extras={work.extras}
          draftAt={work.draftAt}
          onDraft={(next, extras, closing) => keepDraft(roof, next, extras, closing)}
          onDiscardDraft={async () => {
            await dropDraft(roof).catch(() => undefined);
            setWork({ ...work.saved, draftAt: null, saved: work.saved });
            setFresh((n) => n + 1);
          }}
          chargers={catalogue.chargers}
          workspace={workspace}
          rates={rates}
          postcode={postcodeIn(roof.address)}
          catalogue={catalogue.panels}
          inverters={catalogue.inverters}
          batteries={catalogue.batteries}
          yieldPerKwDay={YIELD_PER_KW_DAY}
          onSave={async (next, extras, net) => {
            const problem = await saveRoofWork(roof, next, extras);
            if (!problem) {
              tellDeal({ saved: true });
              afterSave.current?.();
              // A roof's first save, or its first with a battery, uses the business's credits: the chip reads them again.
              if (signedIn) window.dispatchEvent(new Event(CREDITS_EVENT));
            }
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
          // A product with no figures: its datasheet looked for online, and the catalogue takes the figures at once.
          onFindSheet={
            signedIn
              ? async (product) => {
                  const res = await findDatasheetOnline(product);
                  if (res.ok) setSheets(res.datasheets);
                  return { ok: res.ok, message: res.message };
                }
              : undefined
          }
          pictureMenu={
            roofImagery && spot ? (
              <PictureMenu lat={roof.lat} lng={roof.lng} imagery={roofImagery} onChange={(value) => setImagery({ spot, value })} />
            ) : undefined
          }
          nearmapPicture={Boolean(roofImagery && roofImagery.use !== "google")}
          sidesReady={Boolean(roofImagery?.ready)}
          nearmapCaptured={nearmapKept?.captured ? capturedWords(nearmapKept.captured) : null}
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
          sitesOnly={signedIn && cleanKind(account?.signedIn ? account.business?.kind : undefined) !== "retailer"}
          savedLabel={kept}
          onUnsaved={noteUnsaved}
          tight={popped}
          footRoom={popped ? 52 : 0}
          onNeedDeal={stray ? () => void putOnDeal("proposal") : popped && canMakeDeal ? () => setDealAsk((n) => n + 1) : undefined}
          bar={
            <>
              {/* In the pop-up the frame around it says where you are: no wordmark, every bit of width for the work. */}
              {!popped && (
                <Link href="/design" aria-label="RENUABL" className="studio-own-mark">
                  <Wordmark className="text-[17px]" />
                </Link>
              )}
              {!popped && (
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
              )}
              {onJob && (
                // The customer's name opens their deal (1 Nov 2026, Martin, as Primero's): inside the design drawer the deal shows on the
                // page underneath (the drawer folds); on its own it goes to the deal.
                <button
                  type="button"
                  onClick={() => {
                    // In the design drawer, the deal shows on the page underneath.
                    if (inDrawer()) return goUnderneath(`/design/deals/${onJob.id}`);
                    if (unsaved.current && !window.confirm("This design has changes that aren't saved. Leave it and lose them?")) return;
                    router.push(`/design/deals/${onJob.id}`);
                  }}
                  className={
                    popped
                      ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-sun-line text-[13px] font-semibold text-white hover:brightness-105"
                      : "inline-flex max-w-52 shrink-0 items-center gap-1.5 rounded-full bg-sun-line px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-105"
                  }
                  title={`${onJob.customerName}: open the deal`}
                >
                  {popped ? (
                    // In the pop-up's rail, their initials.
                    onJob.customerName
                      .split(/s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]!.toUpperCase())
                      .join("")
                  ) : (
                    <>
                      <span className="truncate">{onJob.customerName}</span>
                      <span className="shrink-0 text-white/80">· Open deal</span>
                    </>
                  )}
                </button>
              )}
              {/* Another roof, without leaving the designer; in the pop-up it is the address strip under the picture. */}
              {!popped && (
                <div className="w-72 min-w-44 max-w-full shrink xl:w-80 2xl:w-96">
                  <AddressEntry compact placeholder="Search another address" onPick={pick} />
                </div>
              )}
              {/* The business's design credits (16 Nov 2026, Martin): in the pop-up they sit in the address strip. */}
              {!popped && signedIn && <DesignCredits className="shrink-0" />}
            </>
          }
        />
        {popped && (
          <AddressStrip
            address={roof.address}
            onPick={pick}
            deal={onJob ? { customerName: onJob.customerName } : null}
            onOpenDeal={onJob ? () => goUnderneath(`/design/deals/${onJob.id}`) : undefined}
            askToCreate={dealAsk}
            askToSearch={searchAsk}
            extra={signedIn ? <DesignCredits className="h-10 px-3.5 text-[13px]" /> : null}
            onCreate={canMakeDeal && !stray ? createDealHere : undefined}
            attachTo={stray ? { name: stray.name, onAttach: () => putOnDeal() } : undefined}
          />
        )}
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
          </div>
        )}
        {/* A deal with no place yet (18 Nov 2026, Martin: from "Design required" in the chat it landed on the design home,
            with two search boxes and other people's deals): only the one thing to do, find this customer's home, and its
            roof opens. The deal's address as typed is already in the box. */}
        {noPlace ? (
          <NoPlaceYet
            name={noPlace.name}
            typed={noPlace.typed}
            theirs={theirs?.address ?? null}
            onPick={async (a) => {
              if (typeof a.lat !== "number" || typeof a.lng !== "number") return;
              const address = [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", ");
              const res = await saveJob(noPlace.jobId, { address, lat: a.lat, lng: a.lng });
              if (res.ok) window.location.reload();
              else setProblem(res.message);
            }}
            onTheirs={async () => {
              if (!theirs) return;
              const res = await saveJob(theirs.jobId, { address: theirs.address, lat: theirs.lat, lng: theirs.lng });
              if (res.ok) window.location.reload();
              else setProblem(res.message);
            }}
          />
        ) : (
          ready && <DesignToolHome onPick={pick} onOpen={openOver} />
        )}
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

/** Where is <name>'s home? The one step before a deal with no place on the map can be designed. */
function NoPlaceYet(props: { name: string; typed: string; theirs: string | null; onPick: (a: Address) => void; onTheirs: () => void }) {
  const first = props.name.split(" ")[0] || props.name;
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center px-2 py-10">
      <span className="grid size-12 place-items-center rounded-2xl bg-sun text-sun-line" aria-hidden>
        <MapPin className="size-6" />
      </span>
      <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-ink">Where is {first}&apos;s home?</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
        {props.name}&apos;s deal needs an address on the map before the design can start. Find it below and their roof opens, ready to
        design.
      </p>
      <div className="mt-5">
        <AddressEntry compact autoFocus initial={props.typed} placeholder={`Search ${first}'s address`} onPick={props.onPick} />
      </div>
      {props.typed && (
        <p className="mt-2 text-[12.5px] text-muted">On the deal: {props.typed}. Pick it from the list to place it on the map.</p>
      )}
      {props.theirs && (
        <button
          type="button"
          onClick={props.onTheirs}
          className="mt-4 self-start rounded-full bg-sun-line px-4 py-2 text-[13.5px] font-semibold text-white hover:brightness-105"
        >
          Use {first}&apos;s address: {props.theirs}
        </button>
      )}
    </div>
  );
}
