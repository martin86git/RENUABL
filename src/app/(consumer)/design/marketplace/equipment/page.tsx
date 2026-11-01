import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { TradePage } from "@/components/design/trade";

export const metadata: Metadata = { title: "Equipment", robots: { index: false, follow: false } };

/** Spare equipment other businesses are selling (domain/design/trade.ts). */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <TradePage view="browse" />
    </DesignShell>
  );
}
