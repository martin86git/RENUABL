"use client";

import { CircleHelp, CornerUpLeft, Lightbulb } from "lucide-react";
import { isYesNoQuestion, solBlocks, type SolBlock } from "@/lib/domain/design/sol-format";

/**
 * Answering one of Sol's questions from his message (8 Nov 2026, Martin): `answer` is "Yes" or "No" to send at once,
 * or null to reply to it in the box.
 */
export type OnAnswer = (question: string, answer: "Yes" | "No" | null) => void;

/**
 * Sol's words laid out to read at a glance (5 Nov 2026, Martin; sol-format.ts reads them): short paragraphs, lists with
 * round bullets, the point that matters most in a warm pad, and a question to the reader ringed in the signal orange
 * so it is never missed. `tail` is put at the end of the last block (Sol's caret while he types).
 */
export function SolText({ text, tail, onAnswer }: { text: string; tail?: React.ReactNode; onAnswer?: OnAnswer }) {
  const blocks = solBlocks(text);
  if (!blocks.length) return tail ? <>{tail}</> : null;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <Block key={i} block={b} tail={i === blocks.length - 1 ? tail : null} onAnswer={tail ? undefined : onAnswer} />
      ))}
    </div>
  );
}

function Block({ block, tail, onAnswer }: { block: SolBlock; tail: React.ReactNode; onAnswer?: OnAnswer }) {
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
        <div className="rounded-xl bg-surface px-3 py-2.5 font-medium text-ink ring-2 ring-sun-line/60">
          <p className="flex gap-2.5">
            <CircleHelp className="mt-[0.2em] size-4 shrink-0 text-sun-line" aria-label="A question for you" />
            <span className="min-w-0">
              {block.text}
              {tail}
            </span>
          </p>
          {onAnswer && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-[1.625rem] text-[13px] font-medium">
              {isYesNoQuestion(block.text) && (
                <>
                  <button
                    type="button"
                    onClick={() => onAnswer(block.text, "Yes")}
                    className="rounded-full bg-primary px-3.5 py-1 text-primary-ink hover:opacity-90"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => onAnswer(block.text, "No")}
                    className="rounded-full bg-canvas px-3.5 py-1 text-ink ring-1 ring-line hover:bg-surface-2"
                  >
                    No
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onAnswer(block.text, null)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ink-2 hover:bg-canvas hover:text-ink"
              >
                <CornerUpLeft className="size-3.5" aria-hidden />
                Reply
              </button>
            </div>
          )}
        </div>
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
