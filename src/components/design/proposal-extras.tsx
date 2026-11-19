"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ANNOUNCEMENT_MAX, type BrandKit } from "@/lib/domain/design/brand";
import { loadBrand, saveBrand } from "@/lib/services/proposals";
import { ui } from "./design-shell";

/**
 * On the proposal screen, beside the choices it is published with (19 Nov 2026, Martin): the deposit the customer pays
 * when they order from the configurator ("Due today"), as a share of what they pay, and an announcement across the top
 * of the configurator for a special. Both are the business's own settings (the brand kit, as Settings → Payment keeps
 * the deposit), so they hold for every proposal published from then on, the designer's publish-on-save included; a
 * proposal already sent keeps what it was sent with. Changing them needs the permission to change settings.
 */
export function OrderSettings({ onChanged }: { onChanged: () => void }) {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [percent, setPercent] = useState("");
  const [text, setText] = useState("");
  const [until, setUntil] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    void loadBrand().then((res) => {
      if (gone || !res.ok) return;
      setKit(res.brand);
      setPercent(res.brand.deposit.kind === "percent" ? String(res.brand.deposit.amount) : res.brand.deposit.kind === "none" ? "0" : "");
      setText(res.brand.announcement?.text ?? "");
      setUntil(res.brand.announcement?.until ?? "");
    });
    return () => {
      gone = true;
    };
  }, []);

  const save = async (patch: Partial<BrandKit>, what: string) => {
    setProblem(null);
    const res = await saveBrand(patch);
    if (!res.ok) return setProblem(res.message);
    setKit(res.brand);
    setSaved(what);
    window.setTimeout(() => setSaved((s) => (s === what ? null : s)), 2000);
    onChanged();
  };

  const saveDeposit = () => {
    const n = Number(percent);
    if (percent.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) return setProblem("The deposit is a percentage from 0 to 100.");
    const deposit: BrandKit["deposit"] = n === 0 ? { kind: "none", amount: 0 } : { kind: "percent", amount: Math.round(n * 10) / 10 };
    const now = kit?.deposit;
    if (now && now.kind === deposit.kind && now.amount === deposit.amount) return;
    void save({ deposit }, "deposit");
  };
  const saveAnnouncement = (next: { text: string; until: string }) => {
    const now = kit?.announcement ?? { text: "", until: null };
    if (now.text === next.text.trim() && (now.until ?? "") === next.until) return;
    void save({ announcement: { text: next.text, until: next.until || null } }, "announcement");
  };

  if (!kit) return null;
  const fixed = kit.deposit.kind === "fixed";
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <p className={ui.eyebrow}>The configurator</p>
      <label className={ui.label}>
        Deposit when they order
        <span className="mt-1.5 flex items-center gap-2">
          <input
            className={clsx(ui.input, "w-24 tabular-nums")}
            inputMode="decimal"
            value={percent}
            placeholder={fixed ? "%" : "0"}
            onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={saveDeposit}
            onKeyDown={(e) => e.key === "Enter" && saveDeposit()}
          />
          <span className="text-sm text-ink-2">% of what they pay</span>
          {saved === "deposit" && <span className="text-xs text-positive">Saved</span>}
        </span>
        <span className="mt-1 block text-xs font-normal text-muted">
          {fixed
            ? `Now a fixed $${kit.deposit.amount.toLocaleString("en-AU")}. Type a percentage to use one instead.`
            : "Shown as Due today beside Order. 0 asks for none. Used on every proposal you publish from now."}
        </span>
      </label>
      <label className={ui.label}>
        Announcement for a special (optional)
        <input
          className={clsx(ui.input, "mt-1.5")}
          maxLength={ANNOUNCEMENT_MAX}
          value={text}
          placeholder="Free EV charger with every battery this month"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => saveAnnouncement({ text, until })}
        />
      </label>
      <label className={ui.label}>
        Shows until (optional)
        <span className="mt-1.5 flex items-center gap-2">
          <input
            type="date"
            className={clsx(ui.input, "w-44")}
            value={until}
            onChange={(e) => {
              setUntil(e.target.value);
              saveAnnouncement({ text, until: e.target.value });
            }}
          />
          {saved === "announcement" && <span className="text-xs text-positive">Saved</span>}
        </span>
        <span className="mt-1 block text-xs font-normal text-muted">
          Across the top of the configurator. It goes out with proposals published from now; check any offer you announce is one you can
          honour.
        </span>
      </label>
      {problem && <p className="text-xs text-danger">{problem}</p>}
    </div>
  );
}
