import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { House3d } from "@/components/ui/house-3d";
import { RoofDesigner } from "@/components/ui/roof-designer";
import { getMyLayout } from "@/lib/services/my-account";
import { mapTilesKey } from "@/lib/server/map-tiles";

export const metadata: Metadata = { title: "Your panel layout", robots: { index: false } };

/** The customer's panels on their roof: the installation partner's layout, or the first one from Google's roof model. */
export default async function MyLayoutPage({ searchParams }: PageProps<"/my/layout">) {
  await connection();
  const { record } = await searchParams;
  const layout = typeof record === "string" ? await getMyLayout(record) : null;
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Eyebrow>Your panel layout</Eyebrow>
        <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em]">Your panels on your roof.</h1>
      </div>
      {layout ? (
        <Card className="overflow-hidden p-2">
          <RoofDesigner
            model={layout.model}
            centre={layout.centre}
            imageSrc={`/api/jobs/${record}/roof?size=design`}
            selected={layout.selected}
          />
          <p className="px-3 py-3 text-[14px] text-ink-2">
            {layout.reference} · {layout.selected.length} panels.{" "}
            {layout.confirmed
              ? "This is your installation partner's layout."
              : "A first layout from Google's satellite roof data. Your installation partner confirms it before the install."}
          </p>
          <div className="px-3 pb-3">
            <House3d at={layout.centre} recordKey={record as string} enabled={Boolean(mapTilesKey())} label="See your home in 3D" />
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="text-[15px] text-ink-2">
            Your layout appears here once you&apos;re signed in and we have satellite roof data for your home.{" "}
            <Link href="/login" className="text-ink underline underline-offset-4">
              Log in
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
