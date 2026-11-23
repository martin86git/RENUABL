import sharp from "sharp";
import { COUNTDOWN_FRAMES, countdownFrames, countdownSvg, ended, hexOf, timeLeft } from "@/lib/domain/marketing/countdown";

/** Ends further off than this, or longer ago, aren't drawn: no countdown runs for years. */
const SPAN_MS = 5 * 365 * 86_400_000;

/**
 * GET a marketing email's countdown (`/api/m/t/<end in seconds since 1970>.gif?c=<six hex digits>`; public: mail
 * apps load it). Drawn afresh at each open as the minute from now, played once; never kept, so the next open is right.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/m/t/[end]">) {
  const { end } = await ctx.params;
  const seconds = Number(end.replace(/\.gif$/, ""));
  const colour = hexOf(new URL(request.url).searchParams.get("c"));
  const now = Date.now();
  const endMs = seconds * 1000;
  if (!Number.isInteger(seconds) || !colour || Math.abs(endMs - now) > SPAN_MS) return new Response("Not found", { status: 404 });
  const over = ended(timeLeft(endMs, now));
  const frames = over ? [timeLeft(endMs, now)] : countdownFrames(endMs, now);
  const pngs = await Promise.all(
    frames.map((f) =>
      sharp(Buffer.from(countdownSvg(f, colour)))
        .png()
        .toBuffer(),
    ),
  );
  const gif = await (pngs.length > 1 ? sharp(pngs, { join: { animated: true } }) : sharp(pngs[0]))
    .gif({ colours: 16, effort: 1, dither: 0, loop: 1, ...(pngs.length > 1 ? { delay: Array(COUNTDOWN_FRAMES).fill(1000) } : {}) })
    .toBuffer();
  return new Response(new Uint8Array(gif), {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      expires: "0",
      "x-content-type-options": "nosniff",
    },
  });
}
