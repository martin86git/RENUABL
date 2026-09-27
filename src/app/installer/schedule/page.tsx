import { connection } from "next/server";
import { PageHeader } from "@/components/installer/bits";
import { ScheduleBoard } from "@/components/installer/schedule-board";
import { todayInMarket } from "@/lib/domain/market";
import { listCrews, listJobs } from "@/lib/services/installer";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  await connection();
  const jobs = listJobs().filter((j) => j.stage !== "new");
  return (
    <>
      <PageHeader title="Schedule" subtitle="Week view · assign crews and check status" />
      <ScheduleBoard jobs={jobs} crews={listCrews()} today={todayInMarket()} />
    </>
  );
}
