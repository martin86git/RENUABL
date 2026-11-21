"use client";

import { useEffect, useState } from "react";
import type { Job, JobStage } from "@/lib/domain/design/crm";
import { keyOfDeal, labelOf, moveTo, stageChoices, type OwnStage, type StageNames } from "@/lib/domain/design/pipeline-stages";
import { STAGE_BOOK_EVENT, loadStageBook } from "@/lib/services/crm";

/**
 * The stages the business added and its names for the twelve, read once a visit and again when they change
 * (`stageBookChanged`). Until read, ours.
 */
export function useStageBook(): { stages: OwnStage[]; names: StageNames } {
  const [book, setBook] = useState<{ stages: OwnStage[]; names: StageNames }>({ stages: [], names: {} });
  useEffect(() => {
    let gone = false;
    const read = () => void loadStageBook().then((b) => !gone && setBook(b));
    read();
    window.addEventListener(STAGE_BOOK_EVENT, read);
    return () => {
      gone = true;
      window.removeEventListener(STAGE_BOOK_EVENT, read);
    };
  }, []);
  return book;
}

/** One of the twelve stages by the business's own name for it (pipeline-stages.ts), for any label outside the board. */
export function useStageLabel(): (stage: JobStage) => string {
  const { names } = useStageBook();
  return (stage) => labelOf(stage, names);
}

/** A deal's stage in words: the added stage it sits at, else the business's name for its stage. */
export function useDealStageLabel(): (job: Pick<Job, "stage" | "subStage">) => string {
  const { stages, names } = useStageBook();
  return (job) => {
    const sub = job.subStage ? stages.find((s) => s.id === job.subStage && s.base === job.stage) : undefined;
    return sub?.name ?? labelOf(job.stage, names);
  };
}

/**
 * A deal's stage as a dropdown: the twelve, and under each the stages the business added that count as it
 * (pipeline-stages.ts). Choosing one hands back what to save: the stage, and the added stage or none.
 */
export function StageSelect({
  job,
  className,
  onChange,
}: {
  job: Pick<Job, "stage" | "subStage">;
  className: string;
  onChange: (change: { stage: JobStage; subStage: string | null }) => void;
}) {
  const { stages: own, names } = useStageBook();
  return (
    <select
      className={className}
      value={keyOfDeal(job, own)}
      onChange={(e) => {
        const to = moveTo(e.target.value, own);
        if (to) onChange(to);
      }}
    >
      {stageChoices(own, names).map((c) => (
        <option key={c.key} value={c.key}>
          {c.added ? `  ↳ ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );
}
