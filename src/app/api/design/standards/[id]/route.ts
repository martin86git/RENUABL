import { STANDARDS_LIMITS } from "@/lib/domain/design/standards";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  StandardRefusal,
  finishStandard,
  listStandards,
  putStandardPart,
  removeStandard,
  standardFile,
  validStandardId,
} from "@/lib/server/design-standards-repo";

const gone = () => Response.json({ ok: false, message: "That copy isn't here any more." }, { status: 404 });

/** GET: the copy as a download, streamed a part at a time (so it isn't held to the response size limit). */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/standards/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const file = validStandardId(id) ? await standardFile(who.member.businessId, id) : null;
    if (!file) return new Response("Not found", { status: 404 });
    let n = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (n >= file.parts) return controller.close();
        const bytes = await file.part(n++);
        if (!bytes) return controller.error(new Error("A part of the copy is missing"));
        controller.enqueue(new Uint8Array(bytes));
      },
    });
    return new Response(body, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(file.size),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  });
}

/** PUT ?part=n with the part's bytes as the body: one part of a copy being uploaded. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/standards/[id]">) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const n = Number(new URL(request.url).searchParams.get("part"));
    if (!validStandardId(id) || !Number.isInteger(n)) return gone();
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > STANDARDS_LIMITS.partBytes)
      return Response.json({ ok: false, message: "That part of the file is too large." }, { status: 413 });
    const bytes = Buffer.from(await request.arrayBuffer());
    try {
      if (!(await putStandardPart(who.member.businessId, id, n, bytes))) return gone();
      return Response.json({ ok: true });
    } catch (e) {
      if (e instanceof StandardRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
      throw e;
    }
  });
}

/** POST { do: "finish" }: checks every part is in and the whole is a PDF, then puts the copy in the library. */
export async function POST(request: Request, ctx: RouteContext<"/api/design/standards/[id]">) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const read = await readBody(request, 200);
    if ("refuse" in read) return read.refuse;
    if (read.body.do !== "finish" || !validStandardId(id)) return gone();
    try {
      if (!(await finishStandard(who.member.businessId, id))) return gone();
      return Response.json({ ok: true, copies: await listStandards(who.member.businessId) });
    } catch (e) {
      if (e instanceof StandardRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
      throw e;
    }
  });
}

/** DELETE: takes a copy out of the library (or drops an upload part way through). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/standards/[id]">) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validStandardId(id) || !(await removeStandard(who.member.businessId, id))) return gone();
    return Response.json({ ok: true, copies: await listStandards(who.member.businessId) });
  });
}
