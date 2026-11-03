/**
 * Whether a web address may be fetched by the server on someone's behalf (a datasheet found online): https only, and
 * never this computer, a private network or a cloud's internal addresses. Pure, tested in `net.test.ts`.
 */

/** An IPv4 or IPv6 address that isn't on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  const four = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (four) {
    const [a, b] = [Number(four[1]), Number(four[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v.includes(":")) return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  return true;
}

/** The address, when it is a plain https link to a public host by name or public address; else null. */
export function fetchableUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return isPrivateAddress(host) ? null : u;
  return host.includes(".") ? u : null;
}
