/**
 * Where the roof designer keeps its work. Signed in to a business, it is kept
 * on the server for that business (/api/design/…), so it is there on any
 * device and for everyone in the business. Signed out, it is kept on this
 * device (localStorage), one set of designs per roof, so the designer can be
 * tried before signing up. Either way everything read back is checked
 * (`cleanDesignSet`, `cleanExtras`, `cleanWorkspace`), so a damaged entry
 * opens as an empty design, never a broken screen.
 *
 * Signed in, the server is the only store: nothing is also written to the
 * device, so there are never two copies to disagree. What was on the device
 * before signing in is brought into the account once (`importDeviceWork`) and
 * then removed from the device.
 */
import { PROJECT_CONFLICT, roofKey, type WorkspaceSettings } from "@/lib/domain/design/account";
import { DEFAULT_WORKSPACE, cleanWorkspace, type SupplierList, type Workspace } from "@/lib/domain/design/pricing";
import { cleanExtras, defaultBill, postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { cleanDesignSet, packDesignSet, type DesignSet } from "@/lib/domain/design/roof-design";
import { designAccount } from "./design-account";

/** The roof being designed: where it is, and the address as it is shown. */
export interface DesignRoof {
  address: string;
  lat: number;
  lng: number;
}

const LAST = "renuabl.design.roof";
const WORKSPACE = "renuabl.design.workspace";
/** A roof's entry on the device: "renuabl.design.<lat>,<lng>". */
const ROOF_ENTRY = /^renuabl\.design\.(-?\d+\.\d{5}),(-?\d+\.\d{5})$/;
const CANT_SAVE = "It couldn't be saved on this device. Check that the browser allows this site to keep data.";
const CANT_REACH = "We couldn't reach your account, so this isn't saved yet. Check your connection and save again.";
const SIGNED_OUT = "You've been signed out, so this isn't saved. Sign in again in another tab, then save.";
const keyFor = (roof: Pick<DesignRoof, "lat" | "lng">) => `renuabl.design.${roofKey(roof)}`;

/** Thrown by a load when a signed-in person's saved work can't be fetched: showing an empty roof instead would look like their work was gone. */
export class DesignStoreError extends Error {}

export function emptyDesignSet(roof: Pick<DesignRoof, "lat" | "lng">): DesignSet {
  return { designs: [{ lat: roof.lat, lng: roof.lng, faces: [] }], primary: 0, comments: [] };
}

/** Whether work is kept for a signed-in business ("account") or on this device. */
export async function whereKept(): Promise<"account" | "device"> {
  const account = await designAccount();
  if (account.signedIn && account.state === "ready") return "account";
  // Someone has signed in on this device and the server can't be reached: don't quietly switch to the device.
  if (!account.signedIn && account.unreachable) throw new DesignStoreError(CANT_REACH);
  return "device";
}

/** What the screen says after a save. */
export async function savedLabel(): Promise<string> {
  return (await whereKept().catch(() => "device")) === "account" ? "Saved to your account" : "Saved on this device";
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

interface ServerAnswer {
  ok: boolean;
  message?: string;
}

/** A request to the designer's API. The answer as sent, or a message to show when there wasn't one. */
async function call<T extends ServerAnswer = ServerAnswer>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<(T & { ok: true }) | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.status === 401) return { ok: false, message: SIGNED_OUT };
    const json = (await res.json()) as T;
    return json.ok ? (json as T & { ok: true }) : { ok: false, message: json.message ?? CANT_REACH };
  } catch {
    return { ok: false, message: CANT_REACH };
  }
}

interface ServerProject extends DesignRoof {
  id: string;
  design: unknown;
  extras: unknown;
  version: number;
}

/** Each roof opened in this visit: which saved roof it is and the version last seen, so a save says which copy it is saving over. */
const opened = new Map<string, { id: string; version: number }>();
/** Saves run one at a time, in the order they were asked for. */
let queue: Promise<unknown> = Promise.resolve();
const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
};

/** What the server is known to hold of the settings, so a save sends only what changed. Null until loaded. */
let kept: { settings: string; lists: Map<string, SupplierList> } | null = null;

const settingsOf = (w: Workspace): WorkspaceSettings => ({ components: w.components, install: w.install, settings: w.settings });

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

function deviceRoofWork(roof: Pick<DesignRoof, "lat" | "lng">): { set: DesignSet | null; extras: unknown } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyFor(roof)) ?? "null") as { extras?: unknown } | null;
    return { set: saved ? cleanDesignSet(saved) : null, extras: saved?.extras };
  } catch {
    // A damaged entry opens as an empty design.
    return { set: null, extras: undefined };
  }
}

/** A roof's designs, with the bill and each design's quote settings: what is saved, or an empty design to start on. */
export async function loadRoofWork(roof: DesignRoof, workspace: Workspace): Promise<{ set: DesignSet; extras: DesignExtras }> {
  const defaults = { bill: defaultBill(workspace.settings.bill), postcode: postcodeIn(roof.address) };
  let set: DesignSet | null = null;
  let extras: unknown;
  if ((await whereKept()) === "device") ({ set, extras } = deviceRoofWork(roof));
  else {
    const res = await call<ServerAnswer & { project: ServerProject | null }>(`/api/design/projects?lat=${roof.lat}&lng=${roof.lng}`);
    if (!res.ok) throw new DesignStoreError(res.message);
    opened.delete(roofKey(roof));
    if (res.project) {
      opened.set(roofKey(roof), { id: res.project.id, version: res.project.version });
      set = cleanDesignSet(res.project.design);
      extras = res.project.extras;
    }
  }
  set ??= emptyDesignSet(roof);
  return { set, extras: cleanExtras(extras, set.designs.length, defaults) };
}

async function saveToAccount(roof: DesignRoof, set: DesignSet, extras: DesignExtras): Promise<string | null> {
  const key = roofKey(roof);
  const work = { design: packDesignSet(set), extras };
  const known = opened.get(key);
  if (known) {
    const res = await call<ServerAnswer & { version: number }>(`/api/design/projects/${known.id}`, "PUT", {
      ...work,
      version: known.version,
      address: roof.address,
    });
    if (!res.ok) return res.message;
    opened.set(key, { id: known.id, version: res.version });
    return null;
  }
  // The first save of this roof.
  const res = await call<ServerAnswer & { project: ServerProject; existed: boolean }>("/api/design/projects", "POST", { ...roof, ...work });
  if (!res.ok) return res.message;
  // Someone in the business saved this roof first, after it was opened here: theirs stands, and this copy isn't put over it.
  if (res.existed) return PROJECT_CONFLICT;
  opened.set(key, { id: res.project.id, version: res.project.version });
  return null;
}

/** Null when saved; otherwise what to tell the person. */
export async function saveRoofWork(roof: DesignRoof, set: DesignSet, extras: DesignExtras): Promise<string | null> {
  let where: "account" | "device";
  try {
    where = await whereKept();
  } catch (e) {
    return e instanceof Error ? e.message : CANT_REACH;
  }
  if (where === "account") return inTurn(() => saveToAccount(roof, set, extras));
  try {
    window.localStorage.setItem(keyFor(roof), JSON.stringify({ ...packDesignSet(set), extras }));
    return null;
  } catch {
    return CANT_SAVE;
  }
}

/** The business's saved roofs, most recently changed first. Empty when signed out (a device has no list of its roofs). */
export async function listSavedRoofs(): Promise<(DesignRoof & { id: string; updatedAt: string })[]> {
  if ((await whereKept().catch(() => "device")) !== "account") return [];
  const res = await call<ServerAnswer & { projects: (DesignRoof & { id: string; updatedAt: string })[] }>("/api/design/projects");
  return res.ok ? res.projects : [];
}

// ---------------------------------------------------------------------------
// Settings and price lists
// ---------------------------------------------------------------------------

function deviceWorkspace(): Workspace | null {
  try {
    const saved = window.localStorage.getItem(WORKSPACE);
    return saved ? cleanWorkspace(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

/** The business's settings: price lists, parts, installation rates, margin. The starting figures until something is saved. */
export async function loadWorkspace(): Promise<Workspace> {
  if ((await whereKept()) === "device") return deviceWorkspace() ?? DEFAULT_WORKSPACE;
  const res = await call<ServerAnswer & { settings: unknown; lists: unknown }>("/api/design/workspace");
  if (!res.ok) throw new DesignStoreError(res.message);
  const workspace = cleanWorkspace({
    ...(res.settings && typeof res.settings === "object" ? res.settings : DEFAULT_WORKSPACE),
    lists: res.lists,
  });
  // Nothing saved yet reads as "", so the first save sends the settings whatever they are.
  kept = { settings: res.settings ? JSON.stringify(settingsOf(workspace)) : "", lists: new Map(workspace.lists.map((l) => [l.name, l])) };
  return workspace;
}

/**
 * Sends the server what differs from what it holds: the settings in one small
 * request, and each price list that was added, replaced or removed on its own
 * (a list can be thousands of rows, and the settings are saved with every
 * figure typed). Null when all of it was kept.
 */
async function saveToAccountSettings(next: Workspace): Promise<string | null> {
  kept ??= { settings: "", lists: new Map() };
  for (const name of [...kept.lists.keys()]) {
    if (next.lists.some((l) => l.name === name)) continue;
    const res = await call(`/api/design/workspace/lists?name=${encodeURIComponent(name)}`, "DELETE");
    if (!res.ok) return res.message;
    kept.lists.delete(name);
  }
  // Oldest first, so the server's "newest first" comes out in the same order as here.
  for (const list of [...next.lists].reverse()) {
    if (kept.lists.get(list.name) === list) continue;
    const res = await call("/api/design/workspace/lists", "PUT", { list });
    if (!res.ok) return res.message;
    kept.lists.set(list.name, list);
  }
  const settings = JSON.stringify(settingsOf(next));
  if (settings !== kept.settings) {
    const res = await call("/api/design/workspace", "PUT", { settings: settingsOf(next) });
    if (!res.ok) return res.message;
    kept.settings = settings;
  }
  return null;
}

/** Null when saved; otherwise what to tell the person. */
export async function saveWorkspace(workspace: Workspace): Promise<string | null> {
  let where: "account" | "device";
  try {
    where = await whereKept();
  } catch (e) {
    return e instanceof Error ? e.message : CANT_REACH;
  }
  if (where === "account") return inTurn(() => saveToAccountSettings(workspace));
  try {
    window.localStorage.setItem(WORKSPACE, JSON.stringify(workspace));
    return null;
  } catch {
    return CANT_SAVE;
  }
}

// ---------------------------------------------------------------------------
// The roof last opened (a convenience of this device, signed in or not)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bringing this device's work into the account
// ---------------------------------------------------------------------------

const IMPORTED = "renuabl.design.imported";
/** Roofs sent in one request, and the most one request carries (well under the server's limit). */
const IMPORT_BATCH = 10;
const IMPORT_BATCH_CHARS = 1_200_000;

/**
 * Run once after signing in on a device (per business): sends the roofs and
 * settings kept on the device to the account. The server keeps a roof only
 * where the business has none at that place, and the settings only when the
 * business has none, so nothing in the account is overwritten. Whatever the
 * server confirms it kept is then removed from the device; anything it didn't
 * take stays where it was. Answers with how many roofs came across.
 */
export async function importDeviceWork(businessId: string): Promise<{ roofs: number; settings: boolean }> {
  const done = { roofs: 0, settings: false };
  try {
    if (window.localStorage.getItem(IMPORTED) === businessId) return done;
    const last = loadLastRoof();
    const roofs: (DesignRoof & { design: unknown; extras: unknown; entry: string })[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const entry = window.localStorage.key(i) ?? "";
      const at = ROOF_ENTRY.exec(entry);
      if (!at) continue;
      const roof = { lat: Number(at[1]), lng: Number(at[2]) };
      const { set, extras } = deviceRoofWork(roof);
      if (!set) continue;
      // A device keeps the address of the roof last opened only; the others get theirs the next time they are opened and saved.
      const address = last && roofKey(last) === roofKey(roof) ? last.address : "";
      roofs.push({ ...roof, address, design: packDesignSet(set), extras, entry });
    }
    const workspace = deviceWorkspace();

    let complete = true;
    if (workspace) {
      const res = await call<ServerAnswer & { settings: boolean }>("/api/design/import", "POST", { settings: settingsOf(workspace) });
      if (!res.ok) complete = false;
      else if (res.settings) {
        // The settings are in: now the price lists, one at a time. The device's copy goes only when every one arrived.
        kept = { settings: JSON.stringify(settingsOf(workspace)), lists: new Map() };
        const problem = await saveToAccountSettings(workspace);
        if (problem) complete = false;
        else {
          window.localStorage.removeItem(WORKSPACE);
          done.settings = true;
        }
      }
    }
    for (let i = 0; i < roofs.length;) {
      const batch: typeof roofs = [];
      let size = 0;
      while (i < roofs.length && batch.length < IMPORT_BATCH) {
        const chars = JSON.stringify(roofs[i]).length;
        if (batch.length && size + chars > IMPORT_BATCH_CHARS) break;
        size += chars;
        batch.push(roofs[i++]);
      }
      const res = await call<ServerAnswer & { roofs: string[] }>("/api/design/import", "POST", {
        roofs: batch.map(({ address, lat, lng, design, extras }) => ({ address, lat, lng, design, extras })),
      });
      if (!res.ok) {
        complete = false;
        continue;
      }
      for (const roof of batch) {
        if (!res.roofs.includes(roofKey(roof))) continue;
        window.localStorage.removeItem(roof.entry);
        done.roofs++;
      }
    }
    // Only a run that reached the server throughout counts as the one time: a failed one is tried again on the next visit.
    if (complete) window.localStorage.setItem(IMPORTED, businessId);
  } catch {
    // The device's storage can't be read: there is nothing to bring across.
  }
  return done;
}
