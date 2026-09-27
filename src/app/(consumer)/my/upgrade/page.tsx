import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { Button, Card, Eyebrow } from "@/components/ui/primitives";
import { getUpgrades } from "@/lib/services/home";

export const metadata = { title: "Upgrade" };

export default function UpgradePage() {
  const upgrades = getUpgrades();
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Upgrade</Eyebrow>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[36px]">Made for your home</h1>
        <p className="mt-2 max-w-xl text-[16px] text-muted">
          Suggestions based on how your home actually uses energy. Installed by the team you already know.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {upgrades.map((u) => (
          <Card key={u.id} className="flex flex-col p-6">
            <p className="text-[18px] font-semibold">{u.title}</p>
            <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{u.body}</p>
            <p className="mt-4 text-[14px] font-medium">{u.estimate}</p>
            <Button variant="secondary" className="mt-4 w-full">
              Tell me more
            </Button>
          </Card>
        ))}
      </div>
      <AskRenuabl context="my" prompt="Not sure what's worth it?" />
    </div>
  );
}
