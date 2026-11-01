/**
 * Server only. The job card's moving parts: reading a note (words and photos) from a form, emailing the card to an
 * installer on file with its two drawings as pictures, and serving a photo from the card.
 */
import sharp from "sharp";
import { cleanNoteText, drawingSvg, jobCardEmail, jobFilesProblem, isJobPicture, type JobDrawing } from "@/lib/domain/design/job-card";
import { siteUrl } from "@/lib/domain/sms";
import { emailProvider, sendEmail } from "./email";
import { addJobNote, installerLink, jobCard, markSent } from "./design-job-card-repo";
import { satelliteImage } from "./roof-view";

/** A note sent as a form: its words, the installer's own name (from their link), and its files; or why it can't go. */
export async function readNote(
  request: Request,
): Promise<
  { ok: true; text: string; person: string; files: { name: string; type: string; bytes: Buffer }[] } | { ok: false; message: string }
> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, message: "That couldn't be read." };
  }
  const text = cleanNoteText(form.get("text"));
  const person = typeof form.get("person") === "string" ? String(form.get("person")) : "";
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const problem = jobFilesProblem(files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
  if (problem) return { ok: false, message: problem };
  if (!text && !files.length) return { ok: false, message: "Write a note or add a photo." };
  return {
    ok: true,
    text,
    person,
    files: await Promise.all(
      files.map(async (f) => ({ name: f.name, type: f.type.toLowerCase(), bytes: Buffer.from(await f.arrayBuffer()) })),
    ),
  };
}

/** A photo or PDF from the card, as a download that can't run as a page. */
export function fileResponse(file: { name: string; type: string; bytes: Buffer }): Response {
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.type,
      "content-disposition": `${isJobPicture(file.type) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
    },
  });
}

/** A drawing over its roof picture as a PNG; on a plain ground when the picture can't be had. */
async function drawingPng(drawing: JobDrawing, picture: string | null): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(drawingSvg(drawing, picture)))
      .png()
      .toBuffer();
  } catch (e) {
    console.error("job card drawing failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function roofPicture(roof: { lat: number; lng: number }, address: string): Promise<string | null> {
  try {
    const res = await satelliteImage({ line: address, suburb: "", state: "", postcode: "", ...roof }, "designer");
    if (!res) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Emails the card to an installer on file (chosen by id: nothing typed decides where a customer's details go), from
 * RENUABL's sender in the business's name, replying to the member, with the drawings attached and the installer's link.
 * Written on the deal's record. Says plainly when it can't go.
 */
export async function sendJobCard(
  member: { businessId: string; businessName: string; email: string },
  jobId: string,
  installerId: string,
): Promise<{ ok: true; to: string } | { ok: false; status: number; message: string }> {
  const site = siteUrl();
  if (!emailProvider() || !site) return { ok: false, status: 409, message: "Email isn't set up here yet, so the card can't be sent." };
  const card = await jobCard(member, jobId);
  if (!card) return { ok: false, status: 404, message: "There's no such job." };
  const installer = card.installers?.find((i) => i.id === installerId);
  if (!installer) return { ok: false, status: 404, message: "Choose an installer on file (Settings → Installers)." };
  const token = await installerLink(member.businessId, jobId, installerId);
  const picture = card.roof && (card.layout || card.strings) ? await roofPicture(card.roof, card.job.address) : null;
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const [name, d] of [
    ["panel-layout.png", card.layout],
    ["string-design.png", card.strings],
  ] as const) {
    if (!d) continue;
    const png = await drawingPng(d, picture);
    if (png) attachments.push({ filename: name, content: png, contentType: "image/png" });
  }
  const email = jobCardEmail({
    business: card.business,
    installer: installer.name,
    date: card.job.installDate,
    address: card.job.address,
    customer: { name: card.customer.name, phone: card.customer.phone },
    details: card.details,
    strings: card.stringWords,
    link: `${site}/job/${token}`,
    drawings: attachments.length,
  });
  try {
    await sendEmail({ to: installer.email, ...email, attachments, replyTo: member.email });
  } catch (e) {
    console.error("job card email failed", e instanceof Error ? e.message : e);
    return { ok: false, status: 502, message: "The email couldn't be sent just now. Try again in a moment." };
  }
  await markSent(token);
  await addJobNote(member.businessId, jobId, {
    side: "team",
    by: member.email.split("@")[0],
    byEmail: member.email,
    text: `Sent the job card to ${installer.name} (${installer.email}).`,
    files: [],
  }).catch(() => null);
  return { ok: true, to: installer.name };
}
