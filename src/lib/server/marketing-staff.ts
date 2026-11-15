/** Server only. The staff check every marketing route makes first (RENUABL's own marketing is staff only). */
import { currentSession } from "./accounts";
import { dbConfigured } from "./db";

export async function marketingStaff(): Promise<{ email: string } | null> {
  if (!dbConfigured()) return null;
  const session = await currentSession();
  return session?.role === "staff" ? { email: session.email } : null;
}

export const unauthorised = () => Response.json({ ok: false }, { status: 401 });
export const refuse = (message: string, status = 422) => Response.json({ ok: false, message }, { status });

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
