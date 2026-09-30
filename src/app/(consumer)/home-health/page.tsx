import type { Metadata } from "next";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { HomeHealthCheck } from "@/components/consumer/home-health-check";
import { HEALTH_TEASER } from "@/lib/domain/healthy-home";

export const metadata: Metadata = {
  title: "Home Health check",
  description: HEALTH_TEASER.copy,
  alternates: { canonical: "/home-health" },
};

/** The Home Health check: public from the home page, and the step after reserving. */
export default function HomeHealthPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="flex-1">
        <HomeHealthCheck />
      </main>
    </div>
  );
}
