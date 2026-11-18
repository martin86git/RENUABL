"use client";

import clsx from "clsx";
import { MapPin, Plus, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import type { Address } from "@/lib/domain/types";
import { CUSTOMER_EMAIL_WRONG } from "@/lib/domain/design/crm";
import { AssignTo } from "./assign-to";

/** The details a deal needs to start, as typed in the Create deal window. */
export interface NewDealInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Who the deal is assigned to (a member's email); empty, the business's lead rule decides. */
  owner: string;
}

/**
 * The address under the picture, in the pop-up's grey (16 Nov 2026, Martin: a new address searched from the design home
 * had no deal, so no Record; the address belongs at the foot of the map, larger, with a field to search another and
 * Create deal beside it, the deal made in a window over the designer without going anywhere). It replaces the map pin
 * that hid the address search in the rail's menu.
 */
export function AddressStrip({
  address,
  onPick,
  deal,
  onCreate,
  onOpenDeal,
  extra,
  askToCreate,
  askToSearch,
  attachTo,
}: {
  address: string;
  onPick: (address: Address) => void;
  /** The deal this roof is on, when it is on one. */
  deal: { customerName: string } | null;
  /** Making a deal here (signed in, a business that sells); absent where none can be made. */
  onCreate?: (input: NewDealInput) => Promise<{ ok: true } | { ok: false; message: string }>;
  onOpenDeal?: () => void;
  /** Beside the address: the business's design credits. */
  extra?: React.ReactNode;
  /** Raised (counted up) to open the Create deal window from elsewhere: Proceed to proposal on a roof with no deal. */
  askToCreate?: number;
  /** Raised (counted up) to open the address search from elsewhere: Sol's "Is this the home?" answered no. */
  askToSearch?: number;
  /** The designer was opened for a deal but this roof isn't on it: put it there, in place of Create deal. */
  attachTo?: { name: string; onAttach: () => Promise<{ ok: true } | { ok: false; message: string }> };
}) {
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (askToCreate) setCreating(true);
  }, [askToCreate]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (askToSearch) setSearching(true);
  }, [askToSearch]);
  return (
    <div className="mx-auto mt-1.5 flex w-full max-w-[min(100%,72rem)] flex-wrap items-center gap-2 px-1">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface py-0.5 pl-3.5 pr-1 shadow-sm ring-1 ring-line">
        <MapPin className="size-4 shrink-0 text-sun-line" aria-hidden />
        {searching ? (
          <div className="min-w-0 flex-1">
            <AddressEntry
              compact
              above
              autoFocus
              placeholder="Search another address"
              onPick={(a) => {
                setSearching(false);
                onPick(a);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearching(true)}
            title="Search another address"
            className="min-w-0 flex-1 truncate py-1.5 text-left text-[14.5px] font-medium text-ink"
          >
            {address}
          </button>
        )}
        <button
          type="button"
          onClick={() => setSearching(!searching)}
          aria-label={searching ? "Keep this address" : "Search another address"}
          title={searching ? "Keep this address" : "Search another address"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          {searching ? <X className="size-4" aria-hidden /> : <Search className="size-4" aria-hidden />}
        </button>
      </div>
      {extra}
      {deal ? (
        <button
          type="button"
          onClick={onOpenDeal}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-medium text-ink shadow-sm ring-1 ring-line hover:text-sun-ink"
          title={`${deal.customerName}: open the deal`}
        >
          <UserRound className="size-4 text-sun-line" aria-hidden />
          {deal.customerName}
          <span className="text-muted">· Open deal</span>
        </button>
      ) : attachTo ? (
        <AttachButton {...attachTo} />
      ) : onCreate ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-sun-line px-4 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] hover:brightness-105"
        >
          <Plus className="size-4" aria-hidden /> Create deal
        </button>
      ) : null}
      {creating && onCreate && <NewDealWindow address={address} onCreate={onCreate} onClose={() => setCreating(false)} />}
    </div>
  );
}

const field =
  "h-11 w-full rounded-xl bg-surface px-3 text-[15px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sun-line";

/** The fewest details a deal needs: the customer's name; the address is the roof's; a mobile and email if known. */
function NewDealWindow({
  address,
  onCreate,
  onClose,
}: {
  address: string;
  onCreate: (input: NewDealInput) => Promise<{ ok: true } | { ok: false; message: string }>;
  onClose: () => void;
}) {
  const [input, setInput] = useState<NewDealInput>({ firstName: "", lastName: "", phone: "", email: "", owner: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, onClose]);
  const set = (k: keyof NewDealInput) => (e: React.ChangeEvent<HTMLInputElement>) => setInput({ ...input, [k]: e.target.value });
  const emailOk = !input.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim());
  const ready = input.firstName.trim().length > 0 && emailOk;
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    const res = await onCreate({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      owner: input.owner,
    });
    setBusy(false);
    if (res.ok) onClose();
    else setProblem(res.message);
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <form
        role="dialog"
        aria-modal
        aria-label="Create a deal for this address"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full max-w-md rounded-[22px] bg-canvas p-5 shadow-[0_30px_80px_rgba(11,11,12,0.28)] ring-1 ring-line"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-ink">Create a deal</h2>
            <p className="mt-0.5 text-[13px] text-muted">This design goes on it, and you stay where you are.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[12.5px] font-medium text-ink-2">
              First name
              <input autoFocus required value={input.firstName} onChange={set("firstName")} autoComplete="off" className={field} />
            </label>
            <label className="grid gap-1 text-[12.5px] font-medium text-ink-2">
              Last name
              <input value={input.lastName} onChange={set("lastName")} autoComplete="off" className={field} />
            </label>
          </div>
          <div className="grid gap-1 text-[12.5px] font-medium text-ink-2">
            Address
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] font-normal text-ink">
              <MapPin className="size-4 shrink-0 text-sun-line" aria-hidden />
              <span className="min-w-0 truncate">{address}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[12.5px] font-medium text-ink-2">
              <span>
                Mobile <span className="font-normal text-muted">(optional)</span>
              </span>
              <input value={input.phone} onChange={set("phone")} inputMode="tel" autoComplete="off" className={field} />
            </label>
            <label className="grid gap-1 text-[12.5px] font-medium text-ink-2">
              <span>
                Email <span className="font-normal text-muted">(optional)</span>
              </span>
              <input value={input.email} onChange={set("email")} type="email" autoComplete="off" className={field} />
            </label>
          </div>
          <AssignTo
            value={input.owner}
            onChange={(owner) => setInput({ ...input, owner })}
            className="grid gap-1 text-[12.5px] font-medium text-ink-2"
            selectClassName={clsx(field, "appearance-auto")}
          />
          {!emailOk && <p className="text-[12.5px] text-danger">{CUSTOMER_EMAIL_WRONG}</p>}
          {problem && <p className="text-[12.5px] text-danger">{problem}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[14px] font-medium text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready || busy}
            className={clsx(
              "h-10 rounded-full px-5 text-[14px] font-semibold",
              ready && !busy ? "bg-sun-line text-white hover:brightness-105" : "bg-surface-2 text-muted",
            )}
          >
            {busy ? "Creating…" : "Create deal"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Put the open roof on the deal the designer was opened for (its address follows the roof). */
function AttachButton({ name, onAttach }: { name: string; onAttach: () => Promise<{ ok: true } | { ok: false; message: string }> }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={busy}
      title={problem ?? `Move ${name}'s deal to this address, so this design is on it`}
      onClick={async () => {
        setBusy(true);
        setProblem(null);
        const res = await onAttach();
        setBusy(false);
        if (!res.ok) setProblem(res.message);
      }}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-sun-line px-4 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] hover:brightness-105 disabled:opacity-70"
    >
      <UserRound className="size-4" aria-hidden /> {busy ? "Putting it on the deal…" : problem ? "Try again" : `Put it on ${name}'s deal`}
    </button>
  );
}
