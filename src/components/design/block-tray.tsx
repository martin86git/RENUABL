"use client";

import clsx from "clsx";
import { Minus, Plus, Split, Merge } from "lucide-react";
import type { PanelBlock } from "@/lib/domain/design/panel-blocks";
import { trayWords } from "@/lib/domain/design/panel-blocks";

/**
 * The block tray over the designer (10 Nov 2026, Martin): the panels Sol sized, as blocks to put on the roof. Pick a
 * block (the first is picked to start), then tap the face it goes on: it is laid there in rows from the gutter, and a
 * preview shows where while the pointer is over a face. Each block can be made bigger or smaller, split or joined.
 */
export function BlockTray(props: {
  blocks: PanelBlock[];
  carrying: string | null;
  watts: number;
  busy: boolean;
  note: string | null;
  /** How many the preview under the pointer would lay, and whether that is all of the block. */
  preview: { laid: number; of: number } | null;
  onCarry: (id: string) => void;
  onResize: (id: string, by: number) => void;
  onSplit: (id: string) => void;
  onJoin: (id: string) => void;
  onDone: () => void;
}) {
  const carrying = props.carrying ?? props.blocks[0]?.id ?? null;
  return (
    <div className="absolute left-1/2 top-[4.75rem] z-30 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-1.5">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[22px] bg-primary/90 p-1.5 pl-3.5 text-[13px] text-white shadow-lift ring-1 ring-white/10 backdrop-blur-md">
        <span className="mr-1 text-white/80">
          {props.busy ? "Laying it…" : props.preview ? previewWords(props.preview) : "Tap the face for the lit block"} ·{" "}
          <span className="tabular-nums text-sun-line">{trayWords(props.blocks, props.watts)}</span>
        </span>
        {props.blocks.map((b, i) => (
          <span
            key={b.id}
            className={clsx(
              "flex items-center gap-0.5 rounded-full p-0.5",
              b.id === carrying ? "bg-sun-line text-white" : "bg-white/12 text-white/85 ring-1 ring-white/15",
            )}
          >
            <button
              type="button"
              onClick={() => props.onCarry(b.id)}
              aria-pressed={b.id === carrying}
              title="Pick this block, then tap the face it goes on"
              className="rounded-full px-2.5 py-1 text-[12.5px] font-medium tabular-nums"
            >
              Block {i + 1} · {b.count} panels
            </button>
            <Round label="One panel fewer" onClick={() => props.onResize(b.id, -1)}>
              <Minus className="size-3" aria-hidden />
            </Round>
            <Round label="One panel more" onClick={() => props.onResize(b.id, 1)}>
              <Plus className="size-3" aria-hidden />
            </Round>
            {b.count >= 4 && (
              <Round label="Split this block in two" onClick={() => props.onSplit(b.id)}>
                <Split className="size-3" aria-hidden />
              </Round>
            )}
            {props.blocks.length > 1 && (
              <Round label="Join it to the next block" onClick={() => props.onJoin(b.id)}>
                <Merge className="size-3" aria-hidden />
              </Round>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={props.onDone}
          className="rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-medium hover:bg-white/25"
        >
          Done
        </button>
      </div>
      {props.note && <p className="rounded-full bg-primary/85 px-3 py-1 text-[12px] text-white/85">{props.note}</p>}
    </div>
  );
}

function previewWords(p: { laid: number; of: number }): string {
  if (!p.laid) return "None fit on this face";
  return p.laid < p.of ? `Only ${p.laid} of ${p.of} fit here` : `${p.laid} fit here: tap to lay them`;
}

function Round({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-6 items-center justify-center rounded-full hover:bg-white/20"
    >
      {children}
    </button>
  );
}
