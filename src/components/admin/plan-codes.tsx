"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { CODE_LENGTHS, lengthWords, type CodeLength } from "@/lib/domain/design/plan-codes";

const keyOf = (l: CodeLength) => (l === "forever" ? "forever" : String(l.months));

async function send(body: unknown): Promise<{ ok: boolean; message?: string }> {
  return fetch("/api/admin/plan-codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json() as Promise<{ ok: boolean; message?: string }>)
    .catch(() => ({ ok: false, message: "That didn't go through." }));
}

/** Staff: make a code for the plan (domain/design/plan-codes.ts): its letters, how long it's free, how many may use it. */
export function MakePlanCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [length, setLength] = useState("1");
  const [uses, setUses] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setProblem(null);
    const r = await send({ do: "make", code, length: length === "forever" ? "forever" : Number(length), uses: uses ? Number(uses) : null });
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't go through.");
    setCode("");
    setUses("");
    router.refresh();
  };
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-end gap-2 text-[14px]">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PRIMERO"
            className="h-9 w-40 rounded-md border border-line bg-surface px-2 font-mono uppercase"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">Gives</span>
          <select value={length} onChange={(e) => setLength(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2">
            {CODE_LENGTHS.map((l) => (
              <option key={keyOf(l)} value={keyOf(l)}>
                {lengthWords(l)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">Uses (blank: no limit)</span>
          <input
            value={uses}
            onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="h-9 w-28 rounded-md border border-line bg-surface px-2"
          />
        </label>
        <Button size="sm" disabled={busy || code.trim().length < 3} onClick={() => void make()}>
          {busy ? "Making…" : "Make the code"}
        </Button>
      </div>
      {problem && <p className="mt-2 text-[13px] text-danger">{problem}</p>}
    </div>
  );
}

/** Staff: stop a code, so no one new can use it. */
export function StopPlanCode({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Stop ${code}? Businesses that already used it keep what it gave.`)) return;
        setBusy(true);
        const r = await send({ do: "stop", id });
        setBusy(false);
        if (!r.ok) window.alert(r.message ?? "That didn't go through.");
        router.refresh();
      }}
    >
      Stop
    </Button>
  );
}
