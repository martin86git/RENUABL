import { notFound } from "next/navigation";
import { connection } from "next/server";
import { JobWorkspace } from "@/components/installer/job-workspace";
import { getCurrentInstaller, getJob, listCrews } from "@/lib/services/installer";

export default async function JobPage({ params }: PageProps<"/installer/jobs/[id]">) {
  await connection();
  const { id } = await params;
  const job = getJob(id);
  if (!job) notFound();
  return <JobWorkspace job={job} crews={listCrews()} installerName={getCurrentInstaller().name} />;
}

export async function generateMetadata({ params }: PageProps<"/installer/jobs/[id]">) {
  const { id } = await params;
  const job = getJob(id);
  return { title: job ? `${job.reference} · ${job.customer.name}` : "Job" };
}
