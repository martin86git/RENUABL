"use client";

/**
 * The agent's name, how the voice says it, and why it rings (18 Nov 2026, Martin: "we are missing fields for me to
 * enter the consultants name… a pronunciation field… a section that says reason for the call"). In the settings
 * beside its chat; the opening is shown as it will be said, changing as the fields are typed. Rules in
 * domain/design/call-setup.ts.
 */
import { useState } from "react";
import clsx from "clsx";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  CALL_AUDIENCES,
  CALL_SETUP_COPY as COPY,
  REASON_MAX,
  SAID_AS_MAX,
  USUAL_REASON,
  cleanCallSetup,
  openingPreview,
  sameCallSetup,
  type CallSetup,
} from "@/lib/domain/design/call-setup";
import { CALLER_NAME_MAX } from "@/lib/domain/design/caller";
import { roleOfKey } from "@/lib/domain/install-call";
import { saveCallerName, type CallerState } from "@/lib/services/caller";
import { saveCallSetup } from "@/lib/services/coaching";

const field =
  "mt-1 w-full rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line disabled:bg-canvas disabled:text-muted";
const label = "block text-[12px] font-medium text-ink";
const hint = "mt-1 text-[11px] leading-snug text-muted";

export function CallSetupSettings(props: {
  caller: CallerState;
  business: string;
  setup: CallSetup;
  editable: boolean;
  onSaved: (s: CallSetup) => void;
}) {
  const sales = roleOfKey(props.caller.role ?? "sales") === "sales";
  const [name, setName] = useState(props.caller.named ? props.caller.name : "");
  const [draft, setDraft] = useState<CallSetup>(props.setup);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const typedName = name.trim();
  const nameChanged = typedName !== (props.caller.named ? props.caller.name : "") && typedName.length > 0;
  const setupChanged = !sameCallSetup(cleanCallSetup(draft), props.setup);
  const change = (next: Partial<CallSetup>) => {
    setSaid(null);
    setDraft((d) => ({ ...d, ...next }));
  };

  const save = async () => {
    setBusy(true);
    setSaid(null);
    if (nameChanged) {
      const res = await saveCallerName(typedName, props.caller.role ?? "sales");
      if (!res.ok) {
        setBusy(false);
        return setSaid({ ok: false, text: res.message });
      }
    }
    if (setupChanged) {
      const res = await saveCallSetup(draft);
      if (!res.ok) {
        setBusy(false);
        return setSaid({ ok: false, text: res.message });
      }
      setDraft(res.setup);
      props.onSaved(res.setup);
    }
    setBusy(false);
    setSaid({ ok: true, text: COPY.saved });
  };

  return (
    <form
      className="space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && (nameChanged || setupChanged)) void save();
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className={label}>{COPY.name}</span>
          <input
            value={name}
            onChange={(e) => {
              setSaid(null);
              setName(e.target.value);
            }}
            maxLength={CALLER_NAME_MAX}
            disabled={!props.editable || busy}
            placeholder={props.caller.name}
            autoComplete="off"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>{COPY.saidAs}</span>
          <input
            value={draft.saidAs}
            onChange={(e) => change({ saidAs: e.target.value })}
            maxLength={SAID_AS_MAX}
            disabled={!props.editable || busy}
            placeholder="As spelled"
            autoComplete="off"
            className={field}
          />
        </label>
        <p className={clsx(hint, "col-span-2 !mt-0")}>{COPY.saidAsHint}</p>
      </div>

      {sales && (
        <>
          <fieldset disabled={!props.editable || busy}>
            <legend className={label}>{COPY.audience}</legend>
            <div className="mt-1 inline-flex rounded-full bg-surface-2 p-0.5">
              {CALL_AUDIENCES.map((a) => {
                const on = draft.audience === a;
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    title={COPY.audiences[a][1]}
                    onClick={() => !on && change({ audience: a })}
                    className={clsx(
                      "rounded-full px-3 py-1 text-[12px] font-medium",
                      on ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {COPY.audiences[a][0]}
                  </button>
                );
              })}
            </div>
            <p className={hint}>{COPY.audiences[draft.audience][1]}</p>
          </fieldset>

          <label className="block">
            <span className={label}>{COPY.reason}</span>
            <textarea
              value={draft.reason}
              onChange={(e) => change({ reason: e.target.value })}
              maxLength={REASON_MAX}
              rows={2}
              disabled={!props.editable || busy}
              placeholder={USUAL_REASON[draft.audience]}
              className={clsx(field, "resize-none leading-snug")}
            />
            <span className={clsx(hint, "block")}>{COPY.reasonHint}</span>
          </label>

          {draft.audience === "cold" && (
            <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[11.5px] leading-snug text-ink">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <span>{COPY.cold}</span>
            </p>
          )}

          <div className="rounded-xl bg-canvas px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{COPY.opening}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-2">
              “
              {openingPreview({
                name: typedName || props.caller.name,
                saidAs: draft.saidAs,
                business: props.business,
                audience: draft.audience,
                reason: draft.reason,
              })}
              ”
            </p>
          </div>
        </>
      )}

      {props.editable ? (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !(nameChanged || setupChanged)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            Save
          </button>
          {said && <p className={clsx("text-xs", said.ok ? "text-ink-2" : "text-danger")}>{said.text}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted">Only an admin can change these.</p>
      )}
    </form>
  );
}
