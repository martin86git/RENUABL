import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { raiseCustomerInvoice, sendInstallerBill, syncXero, xeroOverview } from "@/lib/server/design-xero";
import { disconnectXero, saveXeroSettings, xeroConfig, xeroConnection } from "@/lib/server/xero";
import { allow } from "@/lib/server/rate-limit";

const isId = (v: unknown, prefix: string): v is string => typeof v === "string" && new RegExp(`^${prefix}_[a-f0-9]{8,64}$`).test(v);

/**
 * Settings → Xero, for whoever may change the business's settings. GET: whether Xero is set up on RENUABL, the
 * business's connection and choices, what went to Xero lately, signed jobs with no invoice there and installer
 * invoices not sent. Opening it brings the business up to date with Xero first.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { businessId } = who.member;
    const available = Boolean(xeroConfig());
    let connection = await xeroConnection(businessId);
    if (connection && allow(request, `xero-sync:${businessId}`, 20)) {
      await syncXero(businessId).catch((e) => console.error("Xero couldn't be brought up to date", e instanceof Error ? e.message : e));
      connection = await xeroConnection(businessId);
    }
    return Response.json({
      ok: true,
      available,
      connection,
      ...(connection ? await xeroOverview(businessId) : { recent: [], toInvoice: [], toBill: [] }),
    });
  });
}

/**
 * POST { do: "settings", settings } · { do: "invoice", jobId } raises a signed job's invoice · { do: "bill", id } sends
 * an installer invoice as a bill · { do: "sync" } · { do: "disconnect" }.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone else." }, { status: 403 });
    const read = await readBody(request, 4000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const b = read.body;
    if (!allow(request, `xero:${businessId}`, 120))
      return Response.json({ ok: false, message: "That's a lot of changes at once. Try again in a while." }, { status: 429 });
    if (b.do === "settings") {
      const settings = await saveXeroSettings(businessId, b.settings);
      return settings
        ? Response.json({ ok: true, settings })
        : Response.json({ ok: false, message: "Connect Xero first." }, { status: 409 });
    }
    if (b.do === "disconnect") {
      await disconnectXero(businessId);
      return Response.json({ ok: true });
    }
    if (b.do === "sync") return Response.json({ ok: true, ...(await syncXero(businessId)) });
    if (b.do === "invoice") {
      if (!isId(b.jobId, "job")) return Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
      const sent = await raiseCustomerInvoice(businessId, b.jobId, email);
      return Response.json(sent, { status: sent.ok ? 200 : 409 });
    }
    if (b.do === "bill") {
      if (!isId(b.id, "inv")) return Response.json({ ok: false, message: "There's no such invoice." }, { status: 404 });
      const sent = await sendInstallerBill(businessId, b.id, email);
      return Response.json(sent, { status: sent.ok ? 200 : 409 });
    }
    return Response.json({ ok: false }, { status: 400 });
  });
}
