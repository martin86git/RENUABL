import { PREVIEW_MODE } from "@/lib/config";

/** Makes it obvious to anyone given a preview link that nothing here is real. */
export function PreviewBanner() {
  if (!PREVIEW_MODE) return null;
  return (
    <div role="note" className="bg-[#15161a] px-4 py-1.5 text-center text-[12px] leading-snug text-white/80">
      Preview — sample data only. No real payments, bookings or messages are made.
    </div>
  );
}
