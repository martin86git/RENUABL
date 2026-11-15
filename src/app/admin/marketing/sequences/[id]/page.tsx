import { SequenceEditor } from "@/components/admin/marketing/sequences";

export const metadata = { title: "Sequence" };

export default async function Page({ params }: PageProps<"/admin/marketing/sequences/[id]">) {
  const { id } = await params;
  return <SequenceEditor id={id} />;
}
