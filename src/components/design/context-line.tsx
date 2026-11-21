import clsx from "clsx";

/**
 * Context, said the same way everywhere in RENUABL (18 Nov 2026, Martin: a recognisable "Context" in a persistent
 * colour, then the most concise explainer, so whether a proposal is right is understood at once). The label is
 * always the violet `--context`, kept for this alone; the words after it are one short line.
 */
export function ContextLine({ text, className }: { text: string; className?: string }) {
  return (
    // On a phone the words run under the label to the left edge, not in a narrow column beside it.
    <p className={clsx("min-w-0 text-[12.5px] leading-snug sm:flex sm:items-baseline sm:gap-2", className)}>
      <span className="mr-2 inline-block shrink-0 rounded-md sm:mr-0 bg-context-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-context">
        Context
      </span>
      <span className="min-w-0 text-ink-2">{text}</span>
    </p>
  );
}
