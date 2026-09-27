import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
import { placeAddress } from "@/lib/server/google-places";

/** GET ?id=...&session=... → the full address (with coordinates) for a suggestion. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const session = (url.searchParams.get("session") ?? "").slice(0, 64);

  if (id.startsWith("sample:")) {
    const address = SAMPLE_ADDRESSES[Number(id.slice(7))];
    return address ? Response.json({ address }) : Response.json({ address: null }, { status: 404 });
  }
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key || !/^[\w-]{10,300}$/.test(id)) return Response.json({ address: null }, { status: 400 });
  try {
    const address = await placeAddress(id, session, key);
    return Response.json({ address }, { status: address ? 200 : 422 });
  } catch (e) {
    console.error("address details failed", e instanceof Error ? e.message : e);
    return Response.json({ address: null }, { status: 502 });
  }
}
