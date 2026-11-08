"use client";

import { useState } from "react";
import { CircleHelp, CornerUpLeft, Lightbulb, PencilLine, X } from "lucide-react";
import { isYesNoQuestion, solBlocks, type SolBlock, type SolOption } from "@/lib/domain/design/sol-format";

/**
 * Answering one of Sol's questions from his message (8 Nov 2026, Martin): `answer` is the words to send at once (Yes,
 * No, an option picked, something else typed), or null to reply to it in the box.
 */
export type OnAnswer = (question: string, answer: string | null) => void;

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
    case "choose":
      return <ChoiceCard question={block.text} options={block.options} onAnswer={onAnswer} tail={tail} />;
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

/**
 * Sol's question with its options as a card (8 Nov 2026, Martin, after Claude's own): the question, each option numbered
 * with its line, then Something else to type an answer of their own, Skip and a cross. A press sends that option at
 * once; once answered the card shows what was picked. Without `onAnswer` (while he writes) it is a card to read.
 */
function ChoiceCard({
  question,
  options,
  onAnswer,
  tail,
}: {
  question: string;
  options: SolOption[];
  onAnswer?: OnAnswer;
  tail: React.ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const [skipped, setSkipped] = useState(false);
  const live = Boolean(onAnswer) && !picked && !skipped;
  const choose = (answer: string) => {
    if (!onAnswer || picked) return;
    setPicked(answer);
    onAnswer(question, answer);
  };
  if (skipped)
    return (
      <p className="flex items-center gap-2 text-[0.92em] text-muted">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{question} · skipped</span>
      </p>
    );
  return (
    <div
      className="overflow-hidden rounded-xl bg-surface font-normal text-ink ring-1 ring-line"
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (live && n >= 1 && n <= options.length && !(e.target instanceof HTMLInputElement)) choose(options[n - 1].label);
      }}
    >
      <div className="flex items-start gap-3 border-b border-line px-3.5 py-2.5">
        <p className="min-w-0 flex-1 font-semibold">
          {question}
          {tail}
        </p>
        {onAnswer && !picked && (
          <button
            type="button"
            onClick={() => setSkipped(true)}
            aria-label="Skip this question"
            className="mt-0.5 text-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <ol>
        {options.map((o, i) => {
          const chosen = picked === o.label;
          return (
            <li key={o.label} className="border-b border-line last:border-b-0">
              <button
                type="button"
                disabled={!live}
                onClick={() => choose(o.label)}
                className={
                  "flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition " +
                  (chosen ? "bg-sun/60" : live ? "hover:bg-canvas" : picked ? "opacity-50" : "")
                }
              >
                <span
                  className={
                    "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums " +
                    (chosen ? "bg-sun-line text-white" : "bg-canvas text-ink-2 ring-1 ring-line")
                  }
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{o.label}</span>
                  {o.detail && <span className="block text-[0.92em] text-muted">{o.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {onAnswer && !picked && (
        <form
          className="flex items-center gap-2 border-t border-line bg-canvas px-3.5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (own.trim()) choose(own.trim());
          }}
        >
          <PencilLine className="size-4 shrink-0 text-sun-line" aria-hidden />
          <input
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            maxLength={500}
            placeholder="Something else"
            aria-label="Answer in your own words"
            className="min-w-0 flex-1 bg-transparent py-1 text-ink outline-none placeholder:text-muted"
          />
          {own.trim() ? (
            <button type="submit" className="rounded-full bg-primary px-3 py-1 text-[13px] font-medium text-primary-ink">
              Send
            </button>
          ) : (
            <button type="button" onClick={() => setSkipped(true)} className="px-1 text-[13px] text-muted hover:text-ink">
              Skip
            </button>
          )}
        </form>
      )}
    </div>
  );
}
