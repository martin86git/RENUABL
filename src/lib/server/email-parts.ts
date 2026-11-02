/**
 * Server only. The pictures and files a member sends with an email to a customer (domain/design/email-compose.ts),
 * read from the request's form, checked again (the browser is never trusted), and made into the email's attachments:
 * pictures shown inside the email under the words, by inline id, and other files as ordinary attachments.
 */

import { attachedLine, emailFileName, emailFilesProblem, isPicture, picturesHtml } from "@/lib/domain/design/email-compose";
import type { Email } from "./email";

export interface EmailParts {
  attachments: NonNullable<Email["attachments"]>;
  /** The pictures' `<img src="cid:…">` tags, to go after the message's HTML. */
  picturesHtml: string;
  /** The files as sent, with their clean names, to keep on the deal. */
  kept: File[];
  /** "(A picture and a file are attached.)" for the plain-text version, or empty. */
  textLine: string;
}

/** The files given with a form (field "file"), or a reason they can't go. */
export function formFiles(form: FormData): { files: File[] } | { problem: string } {
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const problem = emailFilesProblem(files);
  return problem ? { problem } : { files };
}

export async function emailParts(files: readonly File[]): Promise<EmailParts> {
  const attachments: EmailParts["attachments"] = [];
  const ids: string[] = [];
  const kept: File[] = [];
  let pictures = 0;
  for (const f of files) {
    const picture = isPicture(f.type);
    if (picture) pictures += 1;
    const filename = emailFileName(f.name, f.type, pictures);
    const content = Buffer.from(await f.arrayBuffer());
    const contentId = picture ? `picture${pictures}` : undefined;
    if (contentId) ids.push(contentId);
    attachments.push({ filename, content, contentType: f.type, ...(contentId ? { contentId } : {}) });
    kept.push(new File([content], filename, { type: f.type }));
  }
  return { attachments, picturesHtml: picturesHtml(ids), kept, textLine: attachedLine(pictures, files.length - pictures) };
}
