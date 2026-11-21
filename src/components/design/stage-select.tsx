"use client";

import { useEffect, useState } from "react";
import type { Job, JobStage } from "@/lib/domain/design/crm";
import { keyOfDeal, moveTo, stageChoices, type OwnStage } from "@/lib/domain/design/pipeline-stages";
import { loadOwnStages } from "@/lib/services/crm";

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
  const [own, setOwn] = useState<OwnStage[]>([]);
  useEffect(() => {
    let gone = false;
    void loadOwnStages().then((s) => !gone && setOwn(s));
    return () => {
      gone = true;
    };
  }, []);
  return (
    <select
      className={className}
      value={keyOfDeal(job, own)}
      onChange={(e) => {
        const to = moveTo(e.target.value, own);
        if (to) onChange(to);
      }}
    >
      {stageChoices(own).map((c) => (
        <option key={c.key} value={c.key}>
          {c.added ? `  ↳ ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );
}
