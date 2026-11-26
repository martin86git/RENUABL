import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { LOCK_MINUTES, LOCK_WORDS, isLocked, relyingParty } from "@/lib/domain/design/screen-lock";
import { isDemoEmail } from "@/lib/domain/design/demo";
import { answer, readBody } from "@/lib/server/design-context";
import { memberByEmail } from "@/lib/server/design-repo";
import { allow } from "@/lib/server/rate-limit";
import {
  endSessionsOf,
  failedTry,
  hasLockPin,
  lockNow,
  lockPinMatches,
  lockRow,
  markActive,
  passkeysOf,
  requestDevice,
  sessionHash,
  setChallenge,
  takeChallenge,
  unlock,
  usedPasskey,
} from "@/lib/server/screen-lock";

/**
 * The screen lock on this session (domain/design/screen-lock.ts). It works on the signed-in session's own email,
 * never on someone the owner is viewing as, so it passes the view-as proxy. GET: whether it's locked and how it can be
 * unlocked. POST `do`: active (real use; never unlocks), lock, pin, passkey-options, passkey, signout-others, signout-all.
 */
async function who() {
  const idHash = await sessionHash();
  if (!idHash) return null;
  const row = await lockRow(idHash);
  if (!row) return null;
  const member = await memberByEmail(row.email);
  if (!member) return null;
  const device = await requestDevice();
  const exempt = isDemoEmail(row.email);
  return { idHash, row, member, device, locked: !exempt && isLocked(row.activeAt, device) };
}

const hostOf = (request: Request) => request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
const originOf = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${hostOf(request)}`;
};
const no = (status: number, message: string, more: object = {}) => Response.json({ ok: false, message, ...more }, { status });

export async function GET() {
  return answer(async () => {
    const me = await who();
    if (!me) return Response.json({ signedIn: false });
    const [keys, pin] = await Promise.all([passkeysOf(me.member.businessId, me.row.email), hasLockPin(me.member.businessId, me.row.email)]);
    return Response.json({
      signedIn: true,
      locked: me.locked,
      email: me.row.email,
      minutes: LOCK_MINUTES[me.device],
      exempt: isDemoEmail(me.row.email),
      passkeys: keys.length,
      pin,
    });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const me = await who();
    if (!me) return no(401, "Sign in to your business.");
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const what = read.body.do;
    const { businessId } = me.member;

    if (what === "active") {
      const ok = await markActive(me.idHash, LOCK_MINUTES[me.device]);
      return Response.json({ ok: true, locked: !ok && me.locked });
    }
    if (what === "lock") {
      await lockNow(me.idHash);
      return Response.json({ ok: true, locked: true });
    }
    if (what === "signout-others" || what === "signout-all") {
      if (me.locked) return no(423, LOCK_WORDS.title, { locked: true });
      const ended = await endSessionsOf(me.row.email, me.idHash, what === "signout-all");
      return Response.json({ ok: true, ended });
    }

    if (!me.locked) return Response.json({ ok: true, locked: false });
    if (!allow(request, "unlock", 60)) return no(429, "Too many tries. Wait a few minutes.");

    if (what === "pin") {
      // No PIN set: say so, and don't count it as a wrong try.
      if (!(await hasLockPin(businessId, me.row.email))) return no(404, LOCK_WORDS.noPinYet, { noPin: true });
      if (await lockPinMatches(businessId, me.row.email, typeof read.body.pin === "string" ? read.body.pin.trim() : "")) {
        await unlock(me.idHash);
        return Response.json({ ok: true, locked: false });
      }
      const ended = await failedTry(me.idHash);
      return no(ended ? 401 : 403, ended ? LOCK_WORDS.tooMany : "That PIN isn't right.", { ended });
    }

    if (what === "passkey-options") {
      const keys = await passkeysOf(businessId, me.row.email);
      if (!keys.length) return no(404, "No Face ID or passkey is set up for you yet.");
      const options = await generateAuthenticationOptions({
        rpID: relyingParty(hostOf(request)),
        userVerification: "required",
        allowCredentials: keys.map((k) => ({ id: k.id, transports: k.transports as never })),
      });
      await setChallenge(me.idHash, options.challenge);
      return Response.json({ ok: true, options });
    }

    if (what === "passkey") {
      const response = read.body.response as AuthenticationResponseJSON | undefined;
      const challenge = await takeChallenge(me.idHash);
      const key =
        response && typeof response.id === "string"
          ? (await passkeysOf(businessId, me.row.email)).find((k) => k.id === response.id)
          : undefined;
      if (!response || !challenge || !key) return no(400, "That didn't work. Try again.");
      try {
        const result = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge,
          expectedOrigin: originOf(request),
          expectedRPID: relyingParty(hostOf(request)),
          credential: { id: key.id, publicKey: key.publicKey, counter: key.counter, transports: key.transports },
          requireUserVerification: true,
        });
        if (result.verified) {
          await usedPasskey(businessId, key.id, result.authenticationInfo.newCounter);
          await unlock(me.idHash);
          return Response.json({ ok: true, locked: false });
        }
      } catch (e) {
        console.error("passkey unlock refused", e instanceof Error ? e.message : e);
      }
      const ended = await failedTry(me.idHash);
      return no(ended ? 401 : 403, ended ? LOCK_WORDS.tooMany : "Face ID didn't unlock it. Try again.", { ended });
    }

    return no(400, "That isn't something the lock does.");
  });
}
