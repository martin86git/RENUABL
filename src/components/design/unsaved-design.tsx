"use client";

/**
 * A design that is only a draft (25 Nov 2026, Martin, on his phone: the proposal said "This deal has no roof design yet"
 * while the designer showed 35 panels and a battery). The designer keeps unsaved work as the person's own draft; a
 * proposal is worked out only from what is saved. When the deal's roof has a draft of this person's and nothing saved,
 * the proposal screen offers to save it in one press and carries on.
 */
import { useEffect, useState } from "react";
import { loadJob } from "@/lib/services/crm";
import { loadDraft, loadRoofWork, loadWorkspace, saveRoofWork, type DesignRoof } from "@/lib/services/design-store";
import type { OpenDraft } from "@/lib/services/design-store";
import { designPanels } from "@/lib/domain/design/roof-design";

export function UnsavedDesign({ jobId, onSaved }: { jobId: string; onSaved: () => void }) {
  const [found, setFound] = useState<{ roof: DesignRoof; draft: OpenDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const asked = await loadJob(jobId);
        if (!asked.ok || asked.job.lat === null || asked.job.lng === null) return;
        const roof = { address: asked.job.address, lat: asked.job.lat, lng: asked.job.lng };
        const workspace = await loadWorkspace();
        // Learns what is saved first, so the draft is only offered while nothing has been saved over it.
        const saved = await loadRoofWork(roof, workspace);
        if (saved.set.designs.some((d) => designPanels(d).length > 0)) return;
        const draft = await loadDraft(roof, workspace);
        if (!gone && draft && draft.set.designs.some((d) => designPanels(d).length > 0)) setFound({ roof, draft });
      } catch {
        // Nothing to offer: the usual message stands.
      }
    })();
    return () => {
      gone = true;
    };
  }, [jobId]);

  if (!found) return null;
  const panels = (() => {
    const d = found.draft.set.designs[found.draft.set.primary];
    return d ? designPanels(d).length : 0;
  })();
  const save = async () => {
    setBusy(true);
    setProblem(null);
    const res = await saveRoofWork(found.roof, found.draft.set, found.draft.extras);
    setBusy(false);
    if (res) return setProblem(res);
    setFound(null);
    onSaved();
  };
  return (
    <div className="mt-3 border-t border-sun-line/40 pt-3">
      <p>
        Your design for this roof ({panels} panel{panels === 1 ? "" : "s"}
        {found.draft.set.designs.length > 1 ? `, ${found.draft.set.designs.length} designs` : ""}) is a draft that hasn&apos;t been saved.
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:bg-muted"
      >
        {busy ? "Saving…" : "Save my design and carry on"}
      </button>
      {problem && <p className="mt-2 text-danger">{problem}</p>}
    </div>
  );
}
