import { CampaignEditor } from "@/components/design/marketing/campaigns";

export const metadata = { title: "Campaign" };

export default async function Page({ params }: PageProps<"/design/marketing/campaigns/[id]">) {
  const { id } = await params;
  return <CampaignEditor id={id} />;
}
