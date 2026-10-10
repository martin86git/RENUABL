/**
 * Where the roof designer keeps its work: on this device (localStorage), one
 * set of designs per roof, plus the roof last opened. Everything read back is
 * checked (`cleanDesignSet`), so a damaged or hand-edited entry opens as an
 * empty design, never a broken screen. Swap this for a server store when
 * designs belong to an account.
 */
import { DEFAULT_WORKSPACE, cleanWorkspace, type Workspace } from "@/lib/domain/design/pricing";
import { cleanExtras, defaultBill, postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { cleanDesignSet, packDesignSet, type DesignSet } from "@/lib/domain/design/roof-design";

/** The roof being designed: where it is, and the address as it is shown. */
export interface DesignRoof {
  address: string;
  lat: number;
  lng: number;
}

const LAST = "renuabl.design.roof";
const WORKSPACE = "renuabl.design.workspace";
const CANT_SAVE = "It couldn't be saved on this device. Check that the browser allows this site to keep data.";
const keyFor = (roof: Pick<DesignRoof, "lat" | "lng">) => `renuabl.design.${roof.lat.toFixed(5)},${roof.lng.toFixed(5)}`;

export function emptyDesignSet(roof: Pick<DesignRoof, "lat" | "lng">): DesignSet {
  return { designs: [{ lat: roof.lat, lng: roof.lng, faces: [] }], primary: 0, comments: [] };
}

/** A roof's designs, with the bill and each design's quote settings: what is saved, or an empty design to start on. */
export function loadRoofWork(roof: DesignRoof, workspace: Workspace): { set: DesignSet; extras: DesignExtras } {
  let saved: { extras?: unknown } | null = null;
  let set: DesignSet | null = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(keyFor(roof)) ?? "null");
    set = saved ? cleanDesignSet(saved) : null;
  } catch {
    // A damaged entry opens as an empty design.
  }
  set ??= emptyDesignSet(roof);
  const defaults = { bill: defaultBill(workspace.settings.bill), postcode: postcodeIn(roof.address) };
  return { set, extras: cleanExtras(saved?.extras, set.designs.length, defaults) };
}

/** Null when saved; otherwise what to tell the person. */
export function saveRoofWork(roof: DesignRoof, set: DesignSet, extras: DesignExtras): string | null {
  try {
    window.localStorage.setItem(keyFor(roof), JSON.stringify({ ...packDesignSet(set), extras }));
    return null;
  } catch {
    return CANT_SAVE;
  }
}

/** The business's settings: price lists, parts, installation rates, margin. The starting figures until something is saved. */
export function loadWorkspace(): Workspace {
  try {
    const saved = window.localStorage.getItem(WORKSPACE);
    return saved ? cleanWorkspace(JSON.parse(saved)) : DEFAULT_WORKSPACE;
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

/** Null when saved; otherwise what to tell the person. */
export function saveWorkspace(workspace: Workspace): string | null {
  try {
    window.localStorage.setItem(WORKSPACE, JSON.stringify(workspace));
    return null;
  } catch {
    return CANT_SAVE;
  }
}

export function loadLastRoof(): DesignRoof | null {
  try {
    const r = JSON.parse(window.localStorage.getItem(LAST) ?? "null") as Partial<DesignRoof> | null;
    return r && typeof r.address === "string" && Number.isFinite(r.lat) && Number.isFinite(r.lng)
      ? { address: r.address.slice(0, 200), lat: r.lat as number, lng: r.lng as number }
      : null;
  } catch {
    return null;
  }
}

export function rememberRoof(roof: DesignRoof | null) {
  try {
    if (roof) window.localStorage.setItem(LAST, JSON.stringify(roof));
    else window.localStorage.removeItem(LAST);
  } catch {
    // Nothing to do: the designer still works for this visit.
  }
}
