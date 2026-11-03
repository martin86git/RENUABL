import { redirect } from "next/navigation";

/** An installer's jobs are its home page now, My Jobs (domain/design/my-jobs.ts); a job's card stays at /design/jobs/<id>. */
export default function Page() {
  redirect("/design");
}
