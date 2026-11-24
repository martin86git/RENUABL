/**
 * The video block in a marketing email (22 Nov 2026, Martin: "add a video block to the email builder"). Mail apps
 * don't play video, so the block is the usual way round it: a still of the video with a play button drawn on it,
 * linked to where the video plays. The still is a picture the business uploads, or for a YouTube link the video's own
 * thumbnail, fetched by our server. Pure: reading the link, the thumbnail's key and the play button's drawing.
 */

/** A YouTube video's id from any of its usual links (watch, youtu.be, shorts, embed, live), or null. */
export function youTubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/**
 * What the still is drawn from: an uploaded picture's id ("mimg_…") wins, else "yt-<id>" for a YouTube link, else
 * null (the block then needs a picture before it can be sent).
 */
export function videoStillKey(imageId: string | null | undefined, url: string | null | undefined): string | null {
  if (imageId && /^mimg_[0-9a-f]{24}$/.test(imageId)) return imageId;
  const yt = youTubeId(url);
  return yt ? `yt-${yt}` : null;
}

/** A still's key read back from an address: the same two shapes, or null. */
export function cleanStillKey(raw: string): string | null {
  const key = raw.replace(/\.jpg$/, "");
  return /^mimg_[0-9a-f]{24}$/.test(key) || /^yt-[A-Za-z0-9_-]{11}$/.test(key) ? key : null;
}

/** Where YouTube keeps a video's still (the large one every video has). */
export const youTubeStill = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** The still's size as drawn (twice what it shows in the email), 16:9. */
export const VIDEO_STILL = { width: 1072, height: 603 } as const;

/** The play button over the still: a round in the button colour with a white triangle, and a soft shadow. */
export function playButtonSvg(colour: string, width: number = VIDEO_STILL.width, height: number = VIDEO_STILL.height): string {
  const r = Math.round(Math.min(width, height) * 0.13);
  const cx = width / 2;
  const cy = height / 2;
  const t = r * 0.42;
  const tri = `${(cx - t * 0.7).toFixed(1)},${(cy - t).toFixed(1)} ${(cx - t * 0.7).toFixed(1)},${(cy + t).toFixed(1)} ${(cx + t * 1.05).toFixed(1)},${cy.toFixed(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/></filter></defs><rect width="${width}" height="${height}" fill="#000" opacity="0.12"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#${colour}" filter="url(#s)"/><polygon points="${tri}" fill="#ffffff" stroke="#ffffff" stroke-width="${Math.round(r * 0.08)}" stroke-linejoin="round"/></svg>`;
}

/** The words a video's link goes under when the block has none of its own. */
export const VIDEO_LINE = "Watch the video";
