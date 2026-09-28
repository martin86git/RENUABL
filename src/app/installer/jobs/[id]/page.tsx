import { notFound } from "next/navigation";
import { connection } from "next/server";
import { JobWorkspace } from "@/components/installer/job-workspace";
import { getCurrentInstaller, getJob, getJobConditions, getJobDesign, isDemo, listCrews } from "@/lib/services/installer";

export default async function JobPage({ params }: PageProps<"/installer/jobs/[id]">) {
  await connection();
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const partner = await getCurrentInstaller();
  return (
    <JobWorkspace
      job={job}
      crews={await listCrews()}
      installerName={partner.name}
      partner={{ type: partner.partnerType ?? "installer", margin: partner.pricing?.margin, rates: partner.pricing?.rates }}
      live={!(await isDemo())}
      conditions={await getJobConditions(job)}
      design={await getJobDesign(job)}
    />
  );
}

export async function generateMetadata({ params }: PageProps<"/installer/jobs/[id]">) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job ? `${job.reference} · ${job.customer.name}` : "Job" };
}
