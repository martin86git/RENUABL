/**
 * Server only. The Marketplace's equipment trading (domain/design/trade.ts). Items are shown to every business while
 * for sale; a business's id never leaves the server (only its name); a conversation about an item is read only by
 * the seller and the one business it is with; photos are redrawn before they are kept (`safeImage`) and served only
 * for an item the business may see.
 */
import { randomBytes } from "node:crypto";
import { roughPlace, suburbAlone } from "@/lib/domain/design/marketplace";
import { PHOTOS_MAX, askedEmail, type ItemInput, type ItemState, type TradeItem, type TradeMessage } from "@/lib/domain/design/trade";
import { siteUrl } from "@/lib/domain/sms";
import { query, transaction } from "./db";
import { safeImage } from "./design-images";
import { emailProvider, sendEmail } from "./email";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
type Who = { businessId: string; businessName: string; email: string };
const newId = (prefix: string) => `${prefix}_${randomBytes(10).toString("hex")}`;

/** A place as sent (the address search's pick), kept only as its suburb and a point rounded to about a kilometre. */
export function placeOf(raw: unknown): { suburb: string; near: { lat: number; lng: number } | null } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const address = typeof r.address === "string" ? r.address.slice(0, 200) : "";
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const inAustralia = lat >= -45 && lat <= -8 && lng >= 110 && lng <= 156;
  return { suburb: suburbAlone(address).slice(0, 60), near: inAustralia ? roughPlace({ lat, lng }) : null };
}

export async function createItem(
  member: Who,
  item: ItemInput,
  place: { suburb: string; near: { lat: number; lng: number } | null },
): Promise<string> {
  const id = newId("itm");
  await query(
    `insert into design_trade_items (id, business_id, category, title, make, model, qty, condition, price, handover, description, suburb,
       near_lat, near_lng, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      member.businessId,
      item.category,
      item.title,
      item.make,
      item.model,
      item.qty,
      item.condition,
      item.price,
      item.handover,
      item.description,
      place.suburb,
      place.near?.lat ?? null,
      place.near?.lng ?? null,
      member.email.toLowerCase(),
    ],
  );
  return id;
}

/** Changes the seller's own item: its details, or only its state (available, pending, sold, withdrawn). */
export async function updateItem(businessId: string, id: string, change: { item?: ItemInput; status?: ItemState }): Promise<boolean> {
  const i = change.item;
  const rows = await query(
    `update design_trade_items set
        category = coalesce($3, category), title = coalesce($4, title), make = coalesce($5, make), model = coalesce($6, model),
        qty = coalesce($7, qty), condition = coalesce($8, condition), price = case when $12 then $9 else price end,
        handover = coalesce($10, handover), description = coalesce($11, description), status = coalesce($13, status), updated_at = now()
      where business_id = $1 and id = $2 returning id`,
    [
      businessId,
      id,
      i?.category ?? null,
      i?.title ?? null,
      i?.make ?? null,
      i?.model ?? null,
      i?.qty ?? null,
      i?.condition ?? null,
      i?.price ?? null,
      i?.handover ?? null,
      i?.description ?? null,
      Boolean(i),
      change.status ?? null,
    ],
  );
  return rows.length > 0;
}

/** Adds photos to the seller's own item (up to the limit), each redrawn first. Answers the problem with the first that can't be used. */
export async function addPhotos(
  businessId: string,
  id: string,
  files: Uint8Array[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const owned = await query<{ n: string }>(
    `select (select count(*) from design_trade_photos p where p.item_id = i.id) as n from design_trade_items i where i.business_id = $1 and i.id = $2`,
    [businessId, id],
  );
  if (!owned[0]) return { ok: false, message: "That item isn't yours." };
  let n = Number(owned[0].n);
  for (const file of files) {
    if (n >= PHOTOS_MAX) return { ok: false, message: `Up to ${PHOTOS_MAX} photos an item.` };
    const safe = await safeImage(file, "photo");
    if ("problem" in safe) return { ok: false, message: safe.problem };
    await query(`insert into design_trade_photos (id, item_id, bytes, content_type, position) values ($1,$2,$3,$4,$5)`, [
      newId("tph"),
      id,
      safe.bytes,
      safe.contentType,
      n++,
    ]);
  }
  return { ok: true };
}

export async function removePhoto(businessId: string, id: string, photoId: string): Promise<boolean> {
  const rows = await query(
    `delete from design_trade_photos p using design_trade_items i where p.id = $3 and p.item_id = i.id and i.id = $2 and i.business_id = $1 returning p.id`,
    [businessId, id, photoId],
  );
  return rows.length > 0;
}

/** Who may see an item: anyone while it is for sale, its seller always, and a business already in a conversation about it. */
const VISIBLE = `(i.status in ('available','pending') or i.business_id = $1
  or exists (select 1 from design_trade_threads t where t.item_id = i.id and t.buyer_id = $1))`;

const ITEM = `i.id, b.name as business, i.category, i.title, i.make, i.model, i.qty, i.condition, i.price::float8 as price, i.handover,
  i.description, i.suburb, i.near_lat, i.near_lng, i.status, ${moment("i.created_at")} as "createdAt", (i.business_id = $1) as mine,
  coalesce((select array_agg(p.id order by p.position, p.at) from design_trade_photos p where p.item_id = i.id), '{}') as photos,
  case when i.business_id = $1 then (select count(*) from design_trade_threads t where t.item_id = i.id) else 0 end as threads,
  case when i.business_id = $1 then (select count(distinct m.thread_id) from design_trade_messages m join design_trade_threads t on t.id = m.thread_id
     where t.item_id = i.id and m.from_business <> $1 and m.read_at is null) else 0 end as unread`;

type ItemRow = Omit<TradeItem, "near" | "threads" | "unread"> & {
  near_lat: number | null;
  near_lng: number | null;
  threads: string;
  unread: string;
};
const toItem = ({ near_lat, near_lng, threads, unread, ...r }: ItemRow): TradeItem => ({
  ...r,
  near: near_lat !== null && near_lng !== null ? { lat: near_lat, lng: near_lng } : null,
  threads: Number(threads),
  unread: Number(unread),
});

export async function listItems(businessId: string): Promise<TradeItem[]> {
  const rows = await query<ItemRow>(
    `select ${ITEM} from design_trade_items i join businesses b on b.id = i.business_id where ${VISIBLE} order by i.created_at desc limit 500`,
    [businessId],
  );
  return rows.map(toItem);
}

export interface Conversation {
  id: string;
  /** The other business, by name. */
  with: string;
  messages: TradeMessage[];
  unread: number;
}

export interface ItemDetail {
  item: TradeItem;
  /** The seller's: one conversation for each business that asked. A buyer's: its own, if it has written. */
  conversations: Conversation[];
}

export async function itemDetail(businessId: string, id: string): Promise<ItemDetail | null> {
  const rows = await query<ItemRow>(
    `select ${ITEM} from design_trade_items i join businesses b on b.id = i.business_id where i.id = $2 and ${VISIBLE}`,
    [businessId, id],
  );
  if (!rows[0]) return null;
  const item = toItem(rows[0]);
  const threads = await query<{ id: string; with: string }>(
    item.mine
      ? `select t.id, b.name as with from design_trade_threads t join businesses b on b.id = t.buyer_id join design_trade_items i on i.id = t.item_id where t.item_id = $2 and i.business_id = $1 order by t.created_at`
      : `select t.id, s.name as with from design_trade_threads t join design_trade_items i on i.id = t.item_id join businesses s on s.id = i.business_id
          where t.item_id = $2 and t.buyer_id = $1`,
    [businessId, id],
  );
  const lines = threads.length
    ? await query<{ id: string; thread: string; own: boolean; business: string; text: string; at: string; unread: boolean }>(
        `select m.id, m.thread_id as thread, (m.from_business = $1) as own, b.name as business, m.text, ${moment("m.at")} as at,
                (m.from_business <> $1 and m.read_at is null) as unread
           from design_trade_messages m join businesses b on b.id = m.from_business where m.thread_id = any($2) order by m.at`,
        [businessId, threads.map((t) => t.id)],
      )
    : [];
  return {
    item,
    conversations: threads.map((t) => {
      const mine = lines.filter((l) => l.thread === t.id);
      return {
        id: t.id,
        with: t.with,
        messages: mine.map(({ id: mid, own, business, text, at }) => ({ id: mid, own, business, text, at })),
        unread: mine.filter((l) => l.unread).length,
      };
    }),
  };
}

/**
 * A message about an item. From a buyer it goes in its own conversation (started on the first); from the seller it
 * must name one of the item's conversations. The other side is emailed from RENUABL when this is the first line they
 * haven't read yet (so a quick back-and-forth isn't an email a line).
 */
export async function sendMessage(
  member: Who,
  id: string,
  text: string,
  threadId: string | null,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const done = await transaction(async (q) => {
    const items = await q<{ seller: string; status: ItemState; title: string; createdBy: string }>(
      `select business_id as seller, status, title, created_by as "createdBy" from design_trade_items where id = $1`,
      [id],
    );
    const item = items[0];
    if (!item) return { ok: false as const, status: 404, message: "That item isn't there any more." };
    const selling = item.seller === member.businessId;
    let thread: string;
    if (selling) {
      const t = await q<{ id: string }>(`select id from design_trade_threads where id = $1 and item_id = $2`, [threadId ?? "", id]);
      if (!t[0]) return { ok: false as const, status: 404, message: "Choose who you're replying to." };
      thread = t[0].id;
    } else {
      const existing = await q<{ id: string }>(`select id from design_trade_threads where item_id = $1 and buyer_id = $2`, [
        id,
        member.businessId,
      ]);
      if (!existing[0] && item.status !== "available" && item.status !== "pending")
        return { ok: false as const, status: 409, message: "This item isn't for sale any more." };
      thread = existing[0]?.id ?? newId("tth");
      if (!existing[0])
        await q(`insert into design_trade_threads (id, item_id, buyer_id) values ($1,$2,$3)`, [thread, id, member.businessId]);
    }
    const waiting = await q<{ n: string }>(
      `select count(*) as n from design_trade_messages where thread_id = $1 and from_business = $2 and read_at is null`,
      [thread, member.businessId],
    );
    await q(`update design_trade_messages set read_at = now() where thread_id = $1 and from_business <> $2 and read_at is null`, [
      thread,
      member.businessId,
    ]);
    await q(`insert into design_trade_messages (id, thread_id, from_business, by_email, text) values ($1,$2,$3,$4,$5)`, [
      newId("tmg"),
      thread,
      member.businessId,
      member.email.toLowerCase(),
      text,
    ]);
    // Who to tell: the seller's lister, or the buyer's last writer.
    const to = selling
      ? (
          await q<{ email: string }>(
            `select by_email as email from design_trade_messages where thread_id = $1 and from_business <> $2 order by at desc limit 1`,
            [thread, member.businessId],
          )
        )[0]?.email
      : item.createdBy;
    return { ok: true as const, tell: Number(waiting[0].n) === 0 && to ? to : null, title: item.title };
  });
  if (!done.ok) return done;
  const site = siteUrl();
  if (done.tell && site && emailProvider())
    await sendEmail({
      to: done.tell,
      ...askedEmail({ item: done.title, buyer: member.businessName, text, link: `${site}/design/marketplace/equipment/${id}` }),
    }).catch((e) => console.error("trade message email failed", e instanceof Error ? e.message : e));
  return { ok: true };
}

/** Marks the other side's lines in a conversation read, for its seller or its buyer only. */
export async function markThreadRead(businessId: string, threadId: string): Promise<void> {
  await query(
    `update design_trade_messages m set read_at = now() from design_trade_threads t join design_trade_items i on i.id = t.item_id
      where m.thread_id = t.id and t.id = $2 and (t.buyer_id = $1 or i.business_id = $1) and m.from_business <> $1 and m.read_at is null`,
    [businessId, threadId],
  );
}

/** A photo, for a business that may see its item. */
export async function tradePhoto(businessId: string, photoId: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ bytes: Buffer; contentType: string }>(
    `select p.bytes, p.content_type as "contentType" from design_trade_photos p join design_trade_items i on i.id = p.item_id
      where p.id = $2 and ${VISIBLE}`,
    [businessId, photoId],
  );
  return rows[0] ?? null;
}

/** How many of this business's items have conversations with lines it hasn't read, and of its own threads as a buyer. */
export async function tradeUnread(businessId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(distinct m.thread_id) as n from design_trade_messages m
       join design_trade_threads t on t.id = m.thread_id join design_trade_items i on i.id = t.item_id
      where (i.business_id = $1 or t.buyer_id = $1) and m.from_business <> $1 and m.read_at is null`,
    [businessId],
  );
  return Number(rows[0]?.n ?? 0);
}
