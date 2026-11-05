"use client";

import { CircleHelp, Lightbulb } from "lucide-react";
import { solBlocks, type SolBlock } from "@/lib/domain/design/sol-format";

/**
 * Sol's words laid out to read at a glance (5 Nov 2026, Martin; sol-format.ts reads them): short paragraphs, lists with
 * round bullets, the point that matters most in a warm pad, and a question to the reader ringed in the signal orange
 * so it is never missed. `tail` is put at the end of the last block (Sol's caret while he types).
 */
export function SolText({ text, tail }: { text: string; tail?: React.ReactNode }) {
  const blocks = solBlocks(text);
  if (!blocks.length) return tail ? <>{tail}</> : null;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <Block key={i} block={b} tail={i === blocks.length - 1 ? tail : null} />
      ))}
    </div>
  );
}

function Block({ block, tail }: { block: SolBlock; tail: React.ReactNode }) {
  switch (block.kind) {
    case "list":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ink/55" aria-hidden />
              <span className="min-w-0">
                {item}
                {i === block.items.length - 1 && tail}
              </span>
            </li>
          ))}
        </ul>
      );
    case "key":
      return (
        <p className="flex gap-2.5 rounded-xl border-l-[3px] border-sun-line bg-sun/70 px-3 py-2.5 font-medium text-ink">
          <Lightbulb className="mt-[0.2em] size-4 shrink-0 text-sun-line" aria-hidden />
          <span className="min-w-0">
            {block.text}
            {tail}
          </span>
        </p>
      );
    case "ask":
      return (
        <p className="flex gap-2.5 rounded-xl bg-surface px-3 py-2.5 font-medium text-ink ring-2 ring-sun-line/60">
          <CircleHelp className="mt-[0.2em] size-4 shrink-0 text-sun-line" aria-label="A question for you" />
          <span className="min-w-0">
            {block.text}
            {tail}
          </span>
        </p>
      );
    case "more":
      return (
        <p className="text-[0.92em] text-muted">
          {block.text}
          {tail}
        </p>
      );
    default:
      return (
        <p className="whitespace-pre-line">
          {block.text}
          {tail}
        </p>
      );
  }
}
