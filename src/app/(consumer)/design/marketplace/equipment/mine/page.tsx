import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { TradePage } from "@/components/design/trade";

export const metadata: Metadata = { title: "My equipment", robots: { index: false, follow: false } };

/** What this business has put up for sale. */
export default function Page() {
  return (
    <DesignShell needsAccount>
      <TradePage view="mine" />
    </DesignShell>
  );
}
