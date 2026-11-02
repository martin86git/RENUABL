"use client";

import clsx from "clsx";
import { ArrowLeft, ImagePlus, MapPin, Package, Plus, Search, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { DISTANCES, type Distance } from "@/lib/domain/design/marketplace";
import {
  CONDITIONS,
  DESCRIPTION_MAX,
  HANDOVER,
  MESSAGE_MAX,
  PHOTOS_MAX,
  TITLE_MAX,
  TRADE_CATEGORIES,
  TRADE_FILTERS,
  browseItems,
  listedWords,
  priceWords,
  type ItemState,
  type TradeItem,
} from "@/lib/domain/design/trade";
import type { Address } from "@/lib/domain/types";
import {
  addItemPhotos,
  createItem,
  itemPath,
  loadItem,
  loadItems,
  messageItem,
  removeItemPhoto,
  setItemStatus,
  tradePhotoSrc,
  type ItemDetail,
} from "@/lib/services/trade";
import { PATHS, PageHead, ui } from "./design-shell";
import { BaseNote } from "./marketplace";

const DISTANCE_KEY = "renuabl.design.trade-distance";
const STATE: Record<ItemState, { label: string; tone: string }> = {
  available: { label: "Available", tone: "bg-positive-soft text-positive" },
  pending: { label: "Pending", tone: "bg-sun text-sun-ink" },
  sold: { label: "Sold", tone: "bg-surface-2 text-muted" },
  withdrawn: { label: "Taken down", tone: "bg-surface-2 text-muted" },
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });

/**
 * Equipment (1 Nov 2026, Martin: "trade unwanted solar equipment... it would work like facebook marketplace"): spare
 * panels, inverters, batteries and more other businesses have put up near you, as photo cards; and your own.
 */
export function TradePage({ view }: { view: "browse" | "mine" }) {
  const [data, setData] = useState<{ items: TradeItem[]; base: { lat: number; lng: number } | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [within, setWithin] = useState<Distance>(100);
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  useEffect(() => {
    try {
      const kept = localStorage.getItem(DISTANCE_KEY);
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (kept) setWithin(kept === "any" ? null : (Number(kept) as Distance));
    } catch {
      // Storage is off: 100 km.
    }
    void loadItems().then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, []);
  const pick = (d: Distance) => {
    setWithin(d);
    try {
      localStorage.setItem(DISTANCE_KEY, d === null ? "any" : String(d));
    } catch {
      // It still changes for this visit.
    }
  };
  const shown = useMemo(() => {
    if (!data) return null;
    if (view === "mine") return data.items.filter((i) => i.mine).map((i) => ({ ...i, km: null }));
    return browseItems(data.items, { base: data.base, within, category, search });
  }, [data, view, within, category, search]);
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <PageHead title={view === "browse" ? "Equipment" : "My equipment"}>
        <Link href={`${PATHS.marketplace}/equipment/new`} className={clsx(ui.primary, "h-9 px-3")}>
          <Plus className="size-4" aria-hidden /> Sell equipment
        </Link>
      </PageHead>
      {view === "browse" && data && !data.base && <BaseNote what="item" onSaved={(base) => setData((d) => d && { ...d, base })} />}
      <p className="-mt-2 text-sm text-ink-2">
        {view === "browse"
          ? "Spare panels, inverters, batteries and more that other businesses are selling near you. Message the seller to ask or make an offer; you arrange payment and pickup between you."
          : "What you've put up for sale, with the businesses that have asked about each."}
      </p>
      {view === "browse" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: a make, a model, a size"
              className={clsx(ui.input, "h-9 min-h-9 pl-9")}
            />
          </div>
          <div role="radiogroup" aria-label="How far" className="flex rounded-md border border-line bg-surface-2 p-0.5 text-sm">
            {DISTANCES.map((d) => (
              <button
                key={String(d)}
                role="radio"
                aria-checked={within === d}
                onClick={() => pick(d)}
                className={clsx(
                  "rounded-[5px] px-3 py-1",
                  within === d ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2",
                )}
              >
                {d === null ? "Anywhere" : `${d} km`}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap gap-2">
            {TRADE_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm ring-1",
                  category === c ? "bg-ink text-white ring-ink" : "bg-surface text-ink-2 ring-line hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!shown ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !shown.length ? (
        <p className={clsx(ui.card, "p-6 text-sm text-ink-2")}>
          {view === "browse"
            ? "Nothing for sale near you that matches. Try further out, or another kind."
            : "You haven't put anything up for sale yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => (
            <li key={i.id}>
              <ItemCard item={i} km={i.km} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** An item as a photo card, the way things for sale are shown: the photo square, the price, what it is, where. */
function ItemCard({ item: i, km }: { item: TradeItem; km: number | null }) {
  return (
    <Link href={itemPath(i.id)} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line transition group-hover:ring-forest">
        {i.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tradePhotoSrc(i.photos[0])}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted">
            <Package className="size-10" aria-hidden />
          </span>
        )}
        {i.status !== "available" && (
          <span className={clsx("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium", STATE[i.status].tone)}>
            {STATE[i.status].label}
          </span>
        )}
        {i.mine && i.unread > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-sun-line px-2 py-0.5 text-[11px] font-semibold text-white">
            {i.unread} new
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[15px] font-semibold text-ink">{priceWords(i.price)}</p>
        <p className="truncate text-sm text-ink">{i.title}</p>
        <p className="truncate text-xs text-muted">
          {i.qty > 1 ? `${i.qty} available · ` : ""}
          {i.suburb}
          {km !== null ? ` · ${km} km` : ""}
        </p>
      </div>
    </Link>
  );
}

/** One item: its photos, what it is, and for a buyer the message to the seller; for the seller the conversations and its state. */
export function ItemPage({ id }: { id: string }) {
  const [d, setD] = useState<ItemDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [thread, setThread] = useState<string | null>(null);
  const files = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void loadItem(id).then((res) => (res.ok ? setD(res) : setProblem(res.message)));
  }, [id]);
  const take = (res: ({ ok: true } & ItemDetail) | { ok: false; message: string }) => {
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setD(res);
  };
  if (!d)
    return (
      <div className={ui.page}>
        <p className="text-sm text-muted">{problem ?? "Loading…"}</p>
      </div>
    );
  const i = d.item;
  const open = i.mine ? (d.conversations.find((c) => c.id === thread) ?? d.conversations[0] ?? null) : (d.conversations[0] ?? null);
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <Link
        href={i.mine ? `${PATHS.marketplace}/equipment/mine` : `${PATHS.marketplace}/equipment`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> {i.mine ? "My equipment" : "Equipment"}
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
            {i.photos[shown] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tradePhotoSrc(i.photos[shown])} alt={i.title} className="size-full object-contain" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted">
                <Package className="size-14" aria-hidden />
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {i.photos.map((p, n) => (
              <div key={p} className="relative">
                <button
                  type="button"
                  onClick={() => setShown(n)}
                  className={clsx("block size-16 overflow-hidden rounded-lg ring-2", n === shown ? "ring-ink" : "ring-transparent")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tradePhotoSrc(p)} alt="" className="size-full object-cover" />
                </button>
                {i.mine && (
                  <button
                    type="button"
                    aria-label="Take this photo off"
                    onClick={async () => {
                      setShown(0);
                      take(await removeItemPhoto(id, p));
                    }}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {i.mine && i.photos.length < PHOTOS_MAX && (
              <>
                <button
                  type="button"
                  onClick={() => files.current?.click()}
                  className="flex size-16 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong text-[10px] text-muted hover:text-ink"
                >
                  <ImagePlus className="size-5" aria-hidden /> Add
                </button>
                <input
                  ref={files}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={async (e) => {
                    const list = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (list.length) take(await addItemPhotos(id, list));
                  }}
                />
              </>
            )}
          </div>
        </section>
        <section className="space-y-4">
          <div className={clsx(ui.card, "p-5")}>
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", STATE[i.status].tone)}>{STATE[i.status].label}</span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{i.title}</h1>
            <p className="mt-1 text-xl text-ink">
              {priceWords(i.price)} <span className="text-sm text-muted">ex GST</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" aria-hidden /> {i.suburb} · {listedWords(i.createdAt)} · {i.business}
            </p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
              {[
                ["Kind", i.category],
                ["Make", i.make],
                ["Model", i.model],
                ["How many", String(i.qty)],
                ["Condition", i.condition],
                ["Handover", i.handover],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
            </dl>
            {i.description && (
              <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm leading-relaxed text-ink">{i.description}</p>
            )}
            {i.mine && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {(["available", "pending", "sold"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={async () => take(await setItemStatus(id, s))}
                    className={clsx(
                      "h-8 rounded-md px-3 text-xs font-medium ring-1",
                      i.status === s ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-forest",
                    )}
                  >
                    {s === "available" ? "Available" : s === "pending" ? "Mark pending" : "Mark sold"}
                  </button>
                ))}
                {i.status !== "withdrawn" && (
                  <button
                    type="button"
                    onClick={async () =>
                      window.confirm("Take this item down? It stops showing to other businesses.") &&
                      take(await setItemStatus(id, "withdrawn"))
                    }
                    className="ml-auto text-xs text-muted underline underline-offset-4 hover:text-danger"
                  >
                    Take it down
                  </button>
                )}
              </div>
            )}
          </div>
          {i.mine ? (
            <div className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>Asked about it</p>
              {!d.conversations.length ? (
                <p className="mt-2 text-sm text-ink-2">No one yet. Businesses near {i.suburb} can see it.</p>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={async () => {
                          setThread(c.id);
                          take(await loadItem(id, c.id));
                        }}
                        className={clsx(
                          "rounded-full px-3 py-1 text-sm ring-1",
                          open?.id === c.id ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line",
                        )}
                      >
                        {c.with}
                        {c.unread > 0 && <span className="ml-1.5 rounded-full bg-sun-line px-1.5 text-[11px] text-white">{c.unread}</span>}
                      </button>
                    ))}
                  </div>
                  {open && (
                    <Thread
                      messages={open.messages}
                      send={async (text) => take(await messageItem(id, text, open.id))}
                      placeholder={`Reply to ${open.with}`}
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <div className={clsx(ui.card, "p-5")}>
              <p className={ui.eyebrow}>{open ? `Your conversation with ${open.with}` : "Ask the seller"}</p>
              <Thread
                messages={open?.messages ?? []}
                send={async (text) => take(await messageItem(id, text))}
                placeholder={open ? "Write a message" : "Is it still available? Would you take an offer?"}
              />
              <p className="mt-2 text-xs text-muted">
                Only you and {i.business} see this. Payment and pickup are between you: RENUABL takes no part in the sale.
              </p>
            </div>
          )}
          {problem && (
            <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
              {problem}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  messages,
  send,
  placeholder,
}: {
  messages: ItemDetail["conversations"][number]["messages"];
  send: (text: string) => Promise<void>;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await send(text.trim());
    setBusy(false);
    setText("");
  };
  return (
    <div className="mt-3">
      {messages.length > 0 && (
        <ol className="mb-3 max-h-80 space-y-1.5 overflow-y-auto rounded-lg bg-canvas p-3">
          {messages.map((m) => (
            <li key={m.id} className={clsx("flex", m.own ? "justify-end" : "justify-start")}>
              <span
                className={clsx(
                  "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
                  m.own ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink",
                )}
              >
                <span className="whitespace-pre-line">{m.text}</span>
                <span className={clsx("mt-0.5 block text-[10px]", m.own ? "text-white/60" : "text-muted")}>
                  {m.own ? "" : `${m.business} · `}
                  {when(m.at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void go();
            }
          }}
          maxLength={MESSAGE_MAX}
          placeholder={placeholder}
          rows={2}
          className={clsx(ui.input, "py-2")}
        />
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink disabled:bg-surface-2 disabled:text-muted"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Selling equipment: what it is, its condition and price, where it is, and photos. */
export function NewItemPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: "Panels",
    title: "",
    make: "",
    model: "",
    qty: "1",
    condition: "New, in the box",
    price: "",
    handover: "Pick up",
    description: "",
  });
  const [place, setPlace] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  const pickPlace = (a: Address) => {
    if (typeof a.lat !== "number" || typeof a.lng !== "number") return setProblem("Pick the suburb from the list as you type.");
    setProblem(null);
    setPlace({ address: [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", "), lat: a.lat, lng: a.lng });
  };
  const submit = async () => {
    if (!place) return setProblem("Say where the equipment is: pick its suburb.");
    setBusy(true);
    const made = await createItem({ ...form, qty: Number(form.qty), price: form.price === "" ? null : Number(form.price), place });
    if (!made.ok) {
      setBusy(false);
      return setProblem(made.message);
    }
    if (photos.length) {
      const up = await addItemPhotos(made.id, photos);
      if (!up.ok) setProblem(up.message);
    }
    router.push(itemPath(made.id));
  };
  return (
    <div className={clsx(ui.page, "max-w-2xl space-y-5")}>
      <Link href={`${PATHS.marketplace}/equipment/mine`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> My equipment
      </Link>
      <PageHead title="Sell equipment" />
      <div className={clsx(ui.card, "space-y-4 p-5")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Kind
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={clsx(ui.input, "mt-1")}>
              {TRADE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={ui.label}>
            Condition
            <select value={form.condition} onChange={(e) => set("condition", e.target.value)} className={clsx(ui.input, "mt-1")}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={ui.label}>
          Title
          <input
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. 20 × 440 W panels, a pallet left over"
            className={clsx(ui.input, "mt-1")}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Make
            <input value={form.make} maxLength={60} onChange={(e) => set("make", e.target.value)} className={clsx(ui.input, "mt-1")} />
          </label>
          <label className={ui.label}>
            Model
            <input value={form.model} maxLength={80} onChange={(e) => set("model", e.target.value)} className={clsx(ui.input, "mt-1")} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={ui.label}>
            How many
            <input
              inputMode="numeric"
              value={form.qty}
              onChange={(e) => set("qty", e.target.value.replace(/[^0-9]/g, ""))}
              className={clsx(ui.input, "mt-1 tabular-nums")}
            />
          </label>
          <label className={ui.label}>
            Price each, ex GST
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Blank: offers"
              className={clsx(ui.input, "mt-1 tabular-nums")}
            />
          </label>
          <label className={ui.label}>
            Handover
            <select value={form.handover} onChange={(e) => set("handover", e.target.value)} className={clsx(ui.input, "mt-1")}>
              {HANDOVER.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className={ui.label}>Where it is</p>
          <div className="mt-1">
            <AddressEntry compact placeholder="The suburb or your warehouse address" onPick={pickPlace} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {place ? `Shown as its suburb only.` : "Other businesses see the suburb only, never the address."}
          </p>
        </div>
        <label className={ui.label}>
          About it
          <textarea
            value={form.description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Why it's spare, any marks, warranty left, what's included"
            className={clsx(ui.input, "mt-1 min-h-24 py-2")}
          />
        </label>
        <div>
          <p className={ui.label}>Photos (up to {PHOTOS_MAX})</p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, PHOTOS_MAX))}
            className="mt-1 block text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink"
          />
          <p className="mt-1 text-xs text-muted">
            Each photo is redrawn before it&apos;s kept, so nothing but the picture goes up (no location from the camera).
          </p>
        </div>
        {problem && (
          <p className="text-sm text-danger" role="alert">
            {problem}
          </p>
        )}
        <button type="button" onClick={() => void submit()} disabled={busy} className={clsx(ui.primary, "w-full")}>
          {busy ? "Putting it up…" : "Put it up for sale"}
        </button>
        <p className="text-xs text-muted">
          Phone numbers, emails, links and street addresses are taken out of the title and description. Buyers message you here.
        </p>
      </div>
    </div>
  );
}
