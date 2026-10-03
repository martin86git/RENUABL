import type { Metadata } from "next";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { BookACall } from "@/components/consumer/book-a-call";
import { CONSULT_CALL } from "@/lib/domain/booking";

export const metadata: Metadata = {
  title: "Book a 15-minute call",
  description: CONSULT_CALL.intro,
  alternates: { canonical: "/book-a-call" },
};

/** Linked from the "finish later" email: a prospect without their bill books a call with the team. */
export default function BookACallPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" />
      <main className="flex-1">
        <BookACall />
      </main>
    </div>
  );
}
