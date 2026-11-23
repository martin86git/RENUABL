"use client";

import Link from "next/link";
import { MessageCircle, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The two rounds that come out of Sol on the phone's dock (23 Nov 2026, Martin: "When tapping on the centre dock sol icon,
 * two round icons emerge out of sol. One says chat the other says feed"): Chat is Today, Sol's own screen; Feed is the
 * deal feed, Deals' landing view. Drawn on the page body, fixed above the round they came from, so the dock's reels
 * can't clip them. A press outside, Escape or a change of page puts them back.
 */
export function SolFan({
  anchor,
  onChat,
  feedHref,
  onClose,
}: {
  anchor: HTMLElement;
  onChat: () => void;
  feedHref: string;
  onClose: () => void;
}) {
  const [at] = useState(() => {
    const r = anchor.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  const round =
    "flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/15";
  return createPortal(
    <div className="theme-studio contents">
      <div className="fixed inset-0 z-[95] bg-black/15" onClick={onClose} aria-hidden />
      <div role="menu" aria-label="Sol" className="fixed z-[96]" style={{ left: at.x, top: at.y, width: 0, height: 0 }}>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onChat();
          }}
          className="sol-fan-item absolute flex flex-col items-center gap-1 text-[11px] font-semibold text-ink"
          style={{ ["--fan-x" as string]: "-58px", ["--fan-y" as string]: "-74px", left: -28, top: -28 }}
        >
          <span className={round}>
            <MessageCircle className="size-6" aria-hidden />
          </span>
          <span className="rounded-full bg-surface px-2 py-0.5 shadow-sm ring-1 ring-line">Chat</span>
        </button>
        <Link
          href={feedHref}
          role="menuitem"
          onClick={onClose}
          className="sol-fan-item absolute flex flex-col items-center gap-1 text-[11px] font-semibold text-ink"
          style={{ ["--fan-x" as string]: "58px", ["--fan-y" as string]: "-74px", left: -28, top: -28, animationDelay: "60ms" }}
        >
          <span className={round}>
            <Rows3 className="size-6 text-sun-line" aria-hidden />
          </span>
          <span className="rounded-full bg-surface px-2 py-0.5 shadow-sm ring-1 ring-line">Feed</span>
        </Link>
      </div>
    </div>,
    document.body,
  );
}
