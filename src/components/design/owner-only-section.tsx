"use client";

/**
 * People who own deals without being invited (24 Nov 2026, Martin: "assign a new user without yet actually inviting
 * them - purely so i can assign them as deal owner on historical deals"). On Your account, for the owner: a name and
 * an email, kept apart from the business's members, so they can't sign in, aren't a paid user and nothing is sent to
 * them. Invite them later and they keep their deals.
 */
import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import {
  addOwnerOnly,
  inviteOwnerOnly,
  loadTeam,
  removeOwnerOnly,
  type MemberLine,
  type OwnerOnlyLine,
  type Team,
} from "@/lib/services/design-account";

const input = "block min-h-11 w-full rounded-md border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-forest";
const primary =
  "inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted";
const card = "rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6";

const dealsWords = (n: number) => (n === 0 ? "No deals yet" : n === 1 ? "Owns 1 deal" : `Owns ${n} deals`);

export function OwnerOnlySection({ onMembers }: { onMembers: (members: MemberLine[]) => void }) {
  const [list, setList] = useState<OwnerOnlyLine[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [asking, setAsking] = useState<{ email: string; act: "invite" | "remove" } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadTeam().then((t) => !gone && t && setList(t.ownerOnly));
    return () => {
      gone = true;
    };
  }, []);

  const took = (res: { team?: Team; problem?: string }, text: string) => {
    if (res.problem || !res.team) return setNote({ text: res.problem ?? "That didn't work. Try again.", error: true });
    setList(res.team.ownerOnly);
    onMembers(res.team.members);
    setNote({ text });
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addOwnerOnly(email.trim(), name.trim());
    took(res, `${name.trim()} can now be chosen as a deal's owner. They haven't been invited.`);
    if (!res.problem) {
      setName("");
      setEmail("");
    }
  };

  return (
    <section className={card} aria-labelledby="owner-only">
      <h2 id="owner-only" className="text-[19px] tracking-tight text-ink">
        Deal owners not invited yet
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Add someone so their deals can carry their name, such as a salesperson on past deals, without inviting them. They can&apos;t sign
        in, aren&apos;t a paid user and we send them nothing. Imports from Pylon, HubSpot or a sheet give them the deals sold under their
        email. Invite them later and they keep their deals.
      </p>
      {note && (
        <p className={`mt-3 text-sm ${note.error ? "text-danger" : "text-positive"}`} role="status">
          {note.text}
        </p>
      )}
      {list && list.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-md border border-line">
          {list.map((p) => (
            <li key={p.email} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {p.email} · Not invited · {dealsWords(p.deals)}
                </p>
              </div>
              {asking?.email === p.email ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink-2">
                    {asking.act === "invite"
                      ? "They'll be able to sign in with this email, and become a paid user."
                      : p.deals
                        ? `Their ${p.deals === 1 ? "deal is" : `${p.deals} deals are`} left with no owner.`
                        : "Take them off the list?"}
                  </span>
                  <button
                    type="button"
                    className="h-9 rounded-md bg-primary px-3 font-medium text-primary-ink hover:bg-forest"
                    onClick={async () => {
                      setAsking(null);
                      if (asking.act === "invite")
                        took(
                          await inviteOwnerOnly(p.email),
                          `${p.name} can now sign in with ${p.email}. We don't email them, so let them know.`,
                        );
                      else took(await removeOwnerOnly(p.email), `${p.name} has been taken off the list.`);
                    }}
                  >
                    {asking.act === "invite" ? "Yes, invite" : "Yes, remove"}
                  </button>
                  <button type="button" className="h-9 rounded-md px-3 text-ink-2 hover:text-ink" onClick={() => setAsking(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAsking({ email: p.email, act: "invite" })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-ink hover:border-forest"
                  >
                    <UserPlus className="size-3.5" aria-hidden />
                    Invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsking({ email: p.email, act: "remove" })}
                    className="flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
                    aria-label={`Remove ${p.name}`}
                    title="Take off the list"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          required
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Their name"
          aria-label="Name of the deal owner"
        />
        <input
          type="email"
          required
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their work email"
          aria-label="Email of the deal owner"
        />
        <button type="submit" className={primary} disabled={!name.trim() || !email.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
