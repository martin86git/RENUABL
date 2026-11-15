import { CampaignEditor } from "@/components/admin/marketing/campaigns";

export const metadata = { title: "Campaign" };

export default async function Page({ params }: PageProps<"/admin/marketing/campaigns/[id]">) {
  const { id } = await params;
  return <CampaignEditor id={id} />;
}
