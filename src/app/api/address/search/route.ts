import { SAMPLE_ADDRESSES, formatAddress } from "@/lib/mock/addresses";
import { autocomplete } from "@/lib/server/google-places";

/** GET ?q=...&session=... → address suggestions (Google Places, or sample addresses without a key). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const session = (url.searchParams.get("session") ?? "").slice(0, 64);
  if (q.length < 3) return Response.json({ suggestions: [] });

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    const lower = q.toLowerCase();
    const suggestions = SAMPLE_ADDRESSES.map((a, i) => ({ a, i }))
      .filter(({ a }) => formatAddress(a).toLowerCase().includes(lower))
      .slice(0, 5)
      .map(({ a, i }) => ({ id: `sample:${i}`, main: a.line, secondary: `${a.suburb} ${a.state} ${a.postcode}` }));
    return Response.json({ suggestions, source: "sample" });
  }
  try {
    return Response.json({ suggestions: await autocomplete(q, session, key), source: "google" });
  } catch (e) {
    console.error("address search failed", e instanceof Error ? e.message : e);
    return Response.json({ suggestions: [], error: true }, { status: 502 });
  }
}
