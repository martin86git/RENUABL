/** Fields and files as a form, for a send that carries pictures or files (the browser sets its own multipart header). */
export function withFiles(fields: Record<string, string>, files: readonly File[]): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("file", f, f.name);
  return form;
}
