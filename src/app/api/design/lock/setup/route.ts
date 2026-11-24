import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { cleanLockPin, passkeyName, relyingParty } from "@/lib/domain/design/screen-lock";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  addPasskey,
  hasLockPin,
  otherSessions,
  passkeysOf,
  removeLockPin,
  removePasskey,
  sessionHash,
  setChallenge,
  setLockPin,
  takeChallenge,
} from "@/lib/server/screen-lock";

/**
 * Your account → Screen lock: the signed-in person's own passkeys (Face ID, Touch ID, Windows Hello) and lock PIN, and
 * how many other devices they're signed in on. Only while unlocked (requireMember), never while viewing as someone.
 */
const hostOf = (request: Request) => request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
const originOf = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${hostOf(request)}`;
};
const no = (status: number, message: string) => Response.json({ ok: false, message }, { status });

async function me() {
  const gate = await requireMember("design");
  if ("refuse" in gate) return gate;
  if (gate.member.viewedBy) return { refuse: no(403, "Go back to your own view to change your screen lock.") };
  return gate;
}

async function state(businessId: string, email: string) {
  const [keys, pin, others] = await Promise.all([
    passkeysOf(businessId, email),
    hasLockPin(businessId, email),
    otherSessions(email, await sessionHash()),
  ]);
  return {
    ok: true,
    passkeys: keys.map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
    pin,
    others,
  };
}

export async function GET() {
  return answer(async () => {
    const gate = await me();
    if ("refuse" in gate) return gate.refuse;
    return Response.json(await state(gate.member.businessId, gate.member.email));
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const gate = await me();
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const what = read.body.do;
    const idHash = await sessionHash();
    if (!idHash) return no(401, "Sign in to your business.");

    if (what === "pin-set") {
      const pin = cleanLockPin(read.body.pin);
      if (!pin.ok) return no(422, pin.message);
      await setLockPin(businessId, email, pin.pin);
    } else if (what === "pin-remove") {
      await removeLockPin(businessId, email);
    } else if (what === "passkey-remove") {
      if (typeof read.body.id !== "string" || !(await removePasskey(businessId, email, read.body.id)))
        return no(404, "That passkey isn't yours.");
    } else if (what === "passkey-options") {
      const keys = await passkeysOf(businessId, email);
      const options = await generateRegistrationOptions({
        rpName: "RENUABL",
        rpID: relyingParty(hostOf(request)),
        userName: email,
        userDisplayName: gate.member.firstName ? `${gate.member.firstName} (${email})` : email,
        attestationType: "none",
        excludeCredentials: keys.map((k) => ({ id: k.id, transports: k.transports as never })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      });
      await setChallenge(idHash, options.challenge);
      return Response.json({ ok: true, options });
    } else if (what === "passkey-add") {
      const response = read.body.response as RegistrationResponseJSON | undefined;
      const challenge = await takeChallenge(idHash);
      if (!response || !challenge) return no(400, "That didn't work. Try again.");
      try {
        const result = await verifyRegistrationResponse({
          response,
          expectedChallenge: challenge,
          expectedOrigin: originOf(request),
          expectedRPID: relyingParty(hostOf(request)),
          requireUserVerification: true,
        });
        if (!result.verified) return no(400, "That passkey couldn't be checked. Try again.");
        const c = result.registrationInfo.credential;
        await addPasskey(businessId, email, {
          id: c.id,
          publicKey: c.publicKey,
          counter: c.counter,
          transports: c.transports ?? [],
          name: passkeyName(request.headers.get("user-agent")),
        });
      } catch (e) {
        console.error("passkey not added", e instanceof Error ? e.message : e);
        return no(400, "That passkey couldn't be checked. Try again.");
      }
    } else return no(400, "That isn't something the screen lock does.");

    return Response.json(await state(businessId, email));
  });
}
