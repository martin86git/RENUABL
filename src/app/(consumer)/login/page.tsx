import type { Metadata } from "next";
import { LoginForm } from "@/components/account/login-form";
import { ConsumerTopBar, MobileHeader } from "@/components/consumer/consumer-top-bar";
import { PREVIEW_MODE } from "@/lib/config";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

/** Log in as a customer or a partner: /login?as=partner&next=/installer/jobs/…&error=expired */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const p = await searchParams;
  const as = p.as === "partner" ? "partner" : "customer";
  const next = typeof p.next === "string" ? p.next : undefined;
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <ConsumerTopBar className="hidden lg:flex" account="Log in" />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <LoginForm initialAs={as} next={next} expired={p.error === "expired"} demo={PREVIEW_MODE} />
      </main>
    </div>
  );
}
