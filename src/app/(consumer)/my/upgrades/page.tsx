import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { Button, Card, Eyebrow } from "@/components/ui/primitives";
import { getUpgrades } from "@/lib/services/home";

export const metadata = { title: "Upgrades" };

export default function UpgradePage() {
  const upgrades = getUpgrades();
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Upgrades</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">Made for your home</h1>
        <p className="mt-2 max-w-xl text-[16px] text-muted">
          Suggestions based on how your home actually uses energy. Installed by the team you already know.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {upgrades.map((u) => (
          <Card key={u.id} className="flex flex-col p-6">
            <p className="text-[18px] font-medium">{u.title}</p>
            <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{u.body}</p>
            <p className="mt-4 text-[14px] font-medium">{u.estimate}</p>
            <Button variant="secondary" className="mt-4 w-full">
              Tell me more
            </Button>
          </Card>
        ))}
      </div>
      <AskRenuabl context="extras" title="Ask RENUABL" subtitle="Which upgrades are right for me?" />
    </div>
  );
}
