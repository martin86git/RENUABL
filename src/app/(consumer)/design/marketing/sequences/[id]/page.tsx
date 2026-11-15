import { SequenceEditor } from "@/components/design/marketing/sequences";

export const metadata = { title: "Sequence" };

export default async function Page({ params }: PageProps<"/design/marketing/sequences/[id]">) {
  const { id } = await params;
  return <SequenceEditor id={id} />;
}
