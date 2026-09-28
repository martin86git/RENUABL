import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { getCompliance } from "@/lib/services/installer";

/** Across the portal: new offers are paused, or something's about to expire. */
export async function ComplianceBanner() {
  const { paused, attention } = await getCompliance();
  if (!attention.length) return null;
  const first = attention[0];
  return (
    <Link
      href="/installer/compliance"
      className="mb-5 flex print:hidden items-start gap-3 rounded-2xl border border-line bg-warning-soft px-4 py-3 text-[14px] text-ink hover:border-line-strong"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <span>
        <span className="font-medium">{paused ? "New job offers are paused." : `Your ${first.label.toLowerCase()} ${first.phrase}.`}</span>{" "}
        <span className="text-ink-2">
          {paused ? "Update your licences and insurance to start receiving offers again." : "Upload the renewal so offers keep coming."}
        </span>
      </span>
    </Link>
  );
}
