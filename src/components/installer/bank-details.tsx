"use client";

import { useEffect, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { formatBsb, maskAccount, validateBankDetails, type BankDetails, type BankErrors } from "@/lib/domain/payouts";
import { FIELD } from "./use-record";

const KEY = "renuabl.partner.bank.v1";

/**
 * Where payouts go, and whether GST is added to them. PREVIEW: kept on this
 * device only. Once partner logins are live it's stored with the partner's
 * account (never in HubSpot or emails).
 */
export function BankDetailsCard() {
  const [saved, setSaved] = useState<BankDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ accountName: "", bsb: "", accountNumber: "", gstRegistered: true });
  const [errors, setErrors] = useState<BankErrors>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const checked = raw ? validateBankDetails(JSON.parse(raw)) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading this device's saved copy once
      if (checked && "bank" in checked) setSaved(checked.bank);
    } catch {
      /* nothing saved */
    }
  }, []);

  function save() {
    const checked = validateBankDetails(draft);
    if ("errors" in checked) return setErrors(checked.errors);
    setErrors({});
    setSaved(checked.bank);
    setEditing(false);
    try {
      localStorage.setItem(KEY, JSON.stringify(checked.bank));
    } catch {
      /* private mode: kept for this visit */
    }
  }

  const field = (name: "accountName" | "bsb" | "accountNumber", label: string, inputMode?: "numeric") => (
    <label className="block">
      <span className="text-[13px] text-muted">{label}</span>
      <input
        value={draft[name]}
        inputMode={inputMode}
        autoComplete="off"
        onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
        className={cn(FIELD, "mt-1.5", errors[name] && "ring-danger")}
      />
      {errors[name] && <span className="mt-1 block text-[12.5px] text-danger">{errors[name]}</span>}
    </label>
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[17px]">Bank details</h2>
      {saved && !editing ? (
        <>
          <dl className="mt-3 space-y-1.5 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Account</dt>
              <dd>{saved.accountName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">BSB · number</dt>
              <dd className="tabular-nums">
                {formatBsb(saved.bsb)} · {maskAccount(saved.accountNumber)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">GST</dt>
              <dd>{saved.gstRegistered ? "Registered: GST added" : "Not registered"}</dd>
            </div>
          </dl>
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditing(true)}>
            Change
          </Button>
        </>
      ) : !editing ? (
        <>
          <p className="mt-2 text-[14px] text-ink-2">Add the account your payouts go to.</p>
          <Button size="sm" className="mt-4" onClick={() => setEditing(true)}>
            Add bank details
          </Button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          {field("accountName", "Account name")}
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            {field("bsb", "BSB", "numeric")}
            {field("accountNumber", "Account number", "numeric")}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[14px]">
            <input
              type="checkbox"
              checked={draft.gstRegistered}
              onChange={(e) => setDraft((d) => ({ ...d, gstRegistered: e.target.checked }))}
              className="h-5 w-5 accent-[var(--positive)]"
            />
            Registered for GST
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <Button size="sm" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p className="mt-4 text-[12px] text-muted">
        We send a recipient-created tax invoice with every payout, so you don&apos;t need to invoice us. Preview: saved on this device only.
      </p>
    </section>
  );
}
