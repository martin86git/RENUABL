"use client";

import Link from "next/link";
import { MessageCircle, Rows3, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Chat and Feed coming out of Sol on the phone's dock (23 Nov 2026, Martin: "two round icons emerge out of sol. One says
 * chat the other says feed"; then "like a 3 leaf clover"). Sol is the clover's third leaf, pointing down into the dock;
 * Chat and Feed are the other two, each a leaf with its point at one centre just above him, a third of a turn apart, and
 * they unfurl from that point. Drawn on the page body, fixed over the round they came from, so the dock's reels can't
 * clip them. A press outside, Escape or a change of page puts them back.
 */

/** How far above Sol's middle the clover's centre sits, and how big a leaf is. */
const CENTRE_UP = 36;
const LEAF = 64;
/** A leaf's point is its bottom-left corner; unturned it reaches up and right (45°). Up-left and up-right leaves sit a
    third of a turn from Sol's, which points straight down. */
const TURN = { chat: -105, feed: 15 } as const;

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
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 - CENTRE_UP };
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
  return createPortal(
    <div className="theme-studio contents">
      <div className="fixed inset-0 z-[95] bg-black/15" onClick={onClose} aria-hidden />
      <div role="menu" aria-label="Sol" className="fixed z-[96] size-0" style={{ left: at.x, top: at.y }}>
        {/* The clover's heart, where the three leaves meet. */}
        <span className="sol-clover-heart absolute -left-1.5 -top-1.5 size-3 rounded-full bg-sun-line" aria-hidden />
        <Leaf
          turn={TURN.chat}
          icon={MessageCircle}
          label="Chat"
          onClick={() => {
            onClose();
            onChat();
          }}
        />
        <Leaf turn={TURN.feed} icon={Rows3} label="Feed" href={feedHref} onClick={onClose} delay={70} />
      </div>
    </div>,
    document.body,
  );
}

function Leaf({
  turn,
  icon: Icon,
  label,
  href,
  onClick,
  delay = 0,
}: {
  turn: number;
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick: () => void;
  delay?: number;
}) {
  const shape = {
    left: 0,
    top: -LEAF,
    width: LEAF,
    height: LEAF,
    ["--leaf-turn" as string]: `${turn}deg`,
    animationDelay: `${delay}ms`,
  };
  const className =
    "sol-clover-leaf absolute flex items-center justify-center rounded-[50%_50%_50%_0] bg-primary text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/15";
  // The words stand upright whatever way the leaf turns.
  const inner = (
    <span className="flex flex-col items-center gap-0.5" style={{ transform: `rotate(${-turn}deg)` }}>
      <Icon className={label === "Feed" ? "size-5 text-sun-line" : "size-5"} aria-hidden />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </span>
  );
  return href ? (
    <Link href={href} role="menuitem" aria-label={label} onClick={onClick} className={className} style={shape}>
      {inner}
    </Link>
  ) : (
    <button type="button" role="menuitem" aria-label={label} onClick={onClick} className={className} style={shape}>
      {inner}
    </button>
  );
}
