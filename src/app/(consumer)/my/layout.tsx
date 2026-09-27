import { MobileHeader } from "@/components/consumer/consumer-top-bar";
import { MyBottomNav, MyTopBar } from "@/components/consumer/my-nav";
import { getHousehold } from "@/lib/services/home";

export default function MyLayout({ children }: LayoutProps<"/my">) {
  const household = getHousehold();
  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader account />
      <MyTopBar name={household.owner} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-28 pt-4 sm:px-8 lg:px-12 lg:pb-16 lg:pt-12">{children}</main>
      <MyBottomNav />
    </div>
  );
}
