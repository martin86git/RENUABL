import type { Metadata } from "next";
import { DesignShell } from "@/components/design/design-shell";
import { NewItemPage } from "@/components/design/trade";

export const metadata: Metadata = { title: "Sell equipment", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <DesignShell needsAccount>
      <NewItemPage />
    </DesignShell>
  );
}
