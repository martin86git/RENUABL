import { InstallationRecord } from "@/components/consumer/installation-record";
import { RECORD_KEY } from "@/lib/domain/handover";
import { getExampleInstallation } from "@/lib/services/home";

export const metadata = { title: "Your installation", robots: { index: false, follow: false } };

/** The installation record: ?record=<key> from the handover link, else the example home's. */
export default async function InstallationPage({ searchParams }: PageProps<"/my/installation">) {
  const { record } = await searchParams;
  const key = typeof record === "string" && RECORD_KEY.test(record) ? record : null;
  return <InstallationRecord recordKey={key} example={getExampleInstallation()} />;
}
