"use client";

import clsx from "clsx";
import { Lightbulb, LightbulbOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  NO_TIP_PREFS,
  TIP_RULES,
  bulbWords,
  cleanTipPrefs,
  tipFor,
  type DesignTip,
  type TipAct,
  type TipMoment,
  type TipPrefs,
} from "@/lib/domain/design/design-tips";

const KEY = "renuabl.design.tips";

function readPrefs(): TipPrefs {
  try {
    return cleanTipPrefs(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
  } catch {
    return NO_TIP_PREFS;
  }
}
function keepPrefs(prefs: TipPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // A private window: the tips are only this visit's.
  }
}

/**
 * "Did you know?" in the designer (10 Nov 2026, Martin; `design-tips.ts`): `nudge` is told what the designer just did,
 * and a tip that answers it may show in a small card by the lightbulb, bottom left of the picture, going by itself after
 * a few seconds. The lightbulb switches tips on and off, kept on the device with the tips already seen.
 */
export function useDesignTips({ onAct, busy }: { onAct: (act: TipAct) => void; busy: () => boolean }) {
  const [prefs, setPrefs] = useState<TipPrefs>(NO_TIP_PREFS);
  const prefsRef = useRef<TipPrefs>(NO_TIP_PREFS);
  useEffect(() => {
    prefsRef.current = readPrefs();
    setPrefs(prefsRef.current);
  }, []);
  const [tip, setTip] = useState<DesignTip | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const visit = useRef({ counts: {} as Partial<Record<TipMoment, number>>, shown: 0, openedAt: 0 });
  useEffect(() => {
    visit.current.openedAt = Date.now();
  }, []);
  const showing = useRef(false);
  const update = (next: TipPrefs) => {
    prefsRef.current = next;
    setPrefs(next);
    keepPrefs(next);
  };

  const nudge = useCallback(
    (moment: TipMoment) => {
      const v = visit.current;
      v.counts[moment] = (v.counts[moment] ?? 0) + 1;
      const found = tipFor(moment, { ...v, now: Date.now(), busy: busy(), showing: showing.current }, prefsRef.current);
      if (!found) return;
      v.shown += 1;
      showing.current = true;
      setTip(found);
      update({ ...prefsRef.current, seen: [...prefsRef.current.seen, found.id] });
    },
    // `busy` is read when told, so the newest is used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const close = () => {
    showing.current = false;
    setTip(null);
  };
  // Gone by itself after a few seconds (held while the pointer is over it).
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!tip || held) return;
    const t = window.setTimeout(close, TIP_RULES.showSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [tip, held]);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  const toggle = () => {
    const off = !prefsRef.current.off;
    update({ ...prefsRef.current, off });
    if (off) close();
    setFlash(off ? "Tips off" : "Tips on");
  };

  const corner: ReactNode = (
    <div className="pointer-events-none absolute bottom-[5.5rem] left-3 z-20 flex items-end gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!prefs.off}
        aria-label={bulbWords(prefs.off)}
        title={bulbWords(prefs.off)}
        className={clsx(
          "pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full border shadow-lift transition",
          prefs.off ? "border-line bg-surface text-muted hover:text-ink" : "border-sun-line/60 bg-surface text-sun-line hover:bg-canvas",
          tip && "ring-2 ring-sun-line/40",
        )}
      >
        {prefs.off ? <LightbulbOff className="size-[18px]" aria-hidden /> : <Lightbulb className="size-[18px]" aria-hidden />}
      </button>
      {tip ? (
        <div
          role="status"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          className="pointer-events-auto w-[min(20rem,calc(100vw-6rem))] rounded-2xl bg-surface/95 px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-lift ring-1 ring-line backdrop-blur-md transition duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none"
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1">
              <span className="mr-1 font-semibold text-sun-ink">Did you know?</span>
              {tip.words}
            </p>
            <button type="button" onClick={close} aria-label="Close the tip" className="-mr-1 shrink-0 text-muted hover:text-ink">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          {tip.act && (
            <button
              type="button"
              onClick={() => {
                const act = tip.act!;
                close();
                onAct(act);
              }}
              className="mt-1.5 rounded-full bg-primary px-3 py-1 text-[12px] font-medium text-primary-ink hover:brightness-110"
            >
              Show me
            </button>
          )}
        </div>
      ) : (
        flash && <span className="rounded-full bg-surface/95 px-2.5 py-1 text-[12px] text-ink-2 shadow-lift ring-1 ring-line">{flash}</span>
      )}
    </div>
  );
  return { nudge, corner };
}
