"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, PenTool, Plus, Search, Trash2, UserPlus } from "lucide-react";
import clsx from "clsx";
import { AddressEntry } from "@/components/consumer/address-entry";
import { JOB_STAGES, LEAD_SOURCES, STAGE_LABELS, type Activity, type Customer, type Job, type JobStage } from "@/lib/domain/design/crm";
import type { Address } from "@/lib/domain/types";
import {
  addActivity,
  createCustomer,
  createJob,
  deleteCustomer,
  deleteJob,
  dollars,
  listCustomers,
  loadCustomer,
  saveCustomer,
  saveJob,
  shortDate,
  type CustomerInput,
  type CustomerLine,
} from "@/lib/services/crm";
import { ACTIVITY_WORD, StageTag } from "./design-home";
import { PATHS, PageHead, ui } from "./design-shell";

const BLANK: CustomerInput = {
  name: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  lat: null,
  lng: null,
  source: "",
  notes: "",
};
const addressLine = (a: Address) => [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", ");

/**
 * Where a customer or a job is: found with the address search, so it comes with its place on the map and its roof
 * can be designed. Once chosen it is shown, with the way to change it.
 */
function AddressField(props: {
  value: string;
  placed: boolean;
  onChange: (place: { address: string; lat: number | null; lng: number | null }) => void;
}) {
  if (props.value)
    return (
      <div className="mt-1.5 flex min-h-10 items-center gap-3 rounded-md border border-line bg-surface-2 px-3 text-sm text-ink">
        <span className="min-w-0 flex-1 truncate">{props.value}</span>
        {!props.placed && <span className="shrink-0 text-xs text-muted">not on the map</span>}
        <button
          type="button"
          onClick={() => props.onChange({ address: "", lat: null, lng: null })}
          className="shrink-0 text-xs font-medium text-ink-2 underline underline-offset-4"
        >
          Change
        </button>
      </div>
    );
  return (
    <div className="mt-1.5">
      <AddressEntry
        compact
        placeholder="Start typing the address"
        onPick={(a) => props.onChange({ address: addressLine(a), lat: a.lat ?? null, lng: a.lng ?? null })}
      />
    </div>
  );
}

/** A customer's details as boxes to fill in. Not a <form>: the address search inside it is one of its own. */
function CustomerFields({ value, onChange, narrow }: { value: CustomerInput; onChange: (next: CustomerInput) => void; narrow?: boolean }) {
  const set = (name: keyof CustomerInput) => (e: { target: { value: string } }) => onChange({ ...value, [name]: e.target.value });
  // The whole name follows its two parts.
  const named = (part: "firstName" | "lastName") => (e: { target: { value: string } }) => {
    const next = { ...value, [part]: e.target.value };
    onChange({ ...next, name: `${next.firstName ?? ""} ${next.lastName ?? ""}`.trim() });
  };
  return (
    <div className={narrow ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
      <label className={ui.label}>
        First name
        <input
          className={clsx(ui.input, "mt-1.5")}
          value={value.firstName ?? ""}
          onChange={named("firstName")}
          maxLength={60}
          autoComplete="off"
        />
      </label>
      <label className={ui.label}>
        Last name
        <input
          className={clsx(ui.input, "mt-1.5")}
          value={value.lastName ?? ""}
          onChange={named("lastName")}
          maxLength={60}
          autoComplete="off"
        />
      </label>
      <label className={clsx(ui.label, !narrow && "sm:col-span-2")}>
        Where they came from
        <select className={clsx(ui.input, "mt-1.5 appearance-auto")} value={value.source} onChange={set("source")}>
          <option value="">Not said</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className={ui.label}>
        Phone
        <input
          className={clsx(ui.input, "mt-1.5")}
          value={value.phone}
          onChange={set("phone")}
          maxLength={30}
          inputMode="tel"
          autoComplete="off"
        />
      </label>
      <label className={ui.label}>
        Email
        <input
          className={clsx(ui.input, "mt-1.5")}
          type="email"
          value={value.email}
          onChange={set("email")}
          maxLength={160}
          autoComplete="off"
        />
      </label>
      <div className={clsx(ui.label, "sm:col-span-2")}>
        Address
        <AddressField value={value.address} placed={value.lat !== null} onChange={(place) => onChange({ ...value, ...place })} />
      </div>
      <label className={clsx(ui.label, "sm:col-span-2")}>
        Notes
        <textarea className={clsx(ui.input, "mt-1.5 py-2")} rows={3} value={value.notes} onChange={set("notes")} maxLength={2000} />
      </label>
    </div>
  );
}

/** /design/customers: everyone the business is dealing with, and the way to add someone. */
export function CustomersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [customers, setCustomers] = useState<CustomerLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [adding, setAdding] = useState(params.get("new") === "1");
  const [draft, setDraft] = useState<CustomerInput>(BLANK);
  const [saving, setSaving] = useState(false);
  const [addProblem, setAddProblem] = useState<string | null>(null);
  // The customer just added, and the deal being offered for them.
  const [deal, setDeal] = useState<{ customer: Customer; title: string; address: string; lat: number | null; lng: number | null } | null>(
    null,
  );

  useEffect(() => {
    let gone = false;
    void listCustomers().then((res) => {
      if (gone) return;
      if (res.ok) setCustomers(res.customers);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q || !customers) return customers ?? [];
    return customers.filter((c) => [c.name, c.email, c.phone, c.address].some((v) => v.toLowerCase().includes(q)));
  }, [customers, find]);

  const add = async () => {
    if (!(draft.firstName ?? "").trim()) return setAddProblem("Enter the customer's first name.");
    setSaving(true);
    // The customer alone: whether to start a deal for them is asked next.
    const res = await createCustomer({ ...draft, deal: false });
    setSaving(false);
    if (!res.ok) return setAddProblem(res.message);
    setAddProblem(null);
    setAdding(false);
    setDraft(BLANK);
    setCustomers((now) => (now ? [{ ...res.customer, jobs: 0, stage: null }, ...now] : now));
    const c = res.customer;
    setDeal({ customer: c, title: "Solar", address: c.address, lat: c.lat, lng: c.lng });
  };
  const startDeal = async () => {
    if (!deal) return;
    setSaving(true);
    const res = await createJob({
      customerId: deal.customer.id,
      title: deal.title.trim() || "Solar",
      address: deal.address,
      lat: deal.lat,
      lng: deal.lng,
    });
    setSaving(false);
    if (!res.ok) return setAddProblem(res.message);
    router.push(`${PATHS.deals}/${res.job.id}`);
  };

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Customers" title="Everyone you're working with.">
        <button className={ui.primary} onClick={() => setAdding(true)} disabled={adding}>
          <UserPlus className="size-4" aria-hidden /> New customer
        </button>
      </PageHead>

      {adding && (
        <section className={clsx(ui.card, "mt-6 p-5 sm:p-6")} aria-labelledby="new-customer">
          <h2 id="new-customer" className="text-[17px] tracking-tight text-ink">
            New customer
          </h2>
          <p className="mt-1 text-sm text-ink-2">Only a name is needed. With an address, a first job is started for it, ready to design.</p>
          <div className="mt-4">
            <CustomerFields value={draft} onChange={setDraft} />
          </div>
          {addProblem && (
            <p className="mt-3 text-[13px] text-danger" role="alert">
              {addProblem}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button className={ui.primary} onClick={add} disabled={saving}>
              {saving ? "Adding…" : "Add customer"}
            </button>
            <button
              className={ui.quiet}
              onClick={() => {
                setAdding(false);
                setDraft(BLANK);
                setAddProblem(null);
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {deal && (
        <section className={clsx(ui.card, "mt-6 border-l-[3px] border-sun-line p-5 sm:p-6")} aria-labelledby="new-deal">
          <h2 id="new-deal" className="text-[17px] tracking-tight text-ink">
            {deal.customer.name} is added. Create a deal for them?
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            A deal is the job you are quoting: it goes into your pipeline as a lead, and with an address found on the map its roof can be
            designed straight away.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <label className={ui.label}>
              What it is
              <input
                className={clsx(ui.input, "mt-1.5")}
                value={deal.title}
                onChange={(e) => setDeal({ ...deal, title: e.target.value })}
                maxLength={80}
                placeholder="Solar, Battery…"
              />
            </label>
            <div className={ui.label}>
              Where
              <AddressField value={deal.address} placed={deal.lat !== null} onChange={(place) => setDeal({ ...deal, ...place })} />
            </div>
          </div>
          {addProblem && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {addProblem}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={ui.primary} onClick={startDeal} disabled={saving}>
              {saving ? "Creating…" : "Create deal"}
            </button>
            <button className={ui.quiet} onClick={() => router.push(`${PATHS.customers}/${deal.customer.id}`)}>
              Not now: open {deal.customer.firstName || "the customer"}
            </button>
            <button className={ui.quiet} onClick={() => setDeal(null)}>
              Close
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 flex items-center gap-3">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Find a customer</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className={clsx(ui.input, "pl-9")}
            placeholder="Find by name, phone, email or address"
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </label>
        {customers && <p className="text-xs tabular-nums text-muted">{shown.length} shown</p>}
      </div>

      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div className={clsx(ui.card, "mt-4 overflow-x-auto")}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Contact</th>
              <th className="px-3 py-3 font-medium">Address</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-5 py-3 text-right font-medium">Jobs</th>
            </tr>
          </thead>
          <tbody>
            {!customers && !problem && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {customers && shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-ink-2">
                  {customers.length ? "Nobody matches that." : "No customers yet. Add your first with New customer."}
                </td>
              </tr>
            )}
            {shown.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`${PATHS.customers}/${c.id}`)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`${PATHS.customers}/${c.id}`}
                    className="font-medium text-ink hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.name}
                  </Link>
                  {c.sample && (
                    <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                      Sample
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-2">
                  {c.phone || c.email || "–"}
                  {c.phone && c.email && <span className="block text-xs text-muted">{c.email}</span>}
                </td>
                <td className="max-w-[18rem] truncate px-3 py-3 text-ink-2">{c.address || "–"}</td>
                <td className="px-3 py-3">{c.stage ? <StageTag stage={c.stage} /> : <span className="text-muted">–</span>}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-2">{c.jobs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {customers?.some((c) => c.sample) && (
        <p className="mt-3 text-xs text-muted">
          The customers marked Sample are made up, to show how this works. Delete them from their own page whenever you like.
        </p>
      )}
    </div>
  );
}

/** One job on a customer's page: where it stands, what it is worth, and the way into its design. */
function JobCard({ job, onChange, onDelete }: { job: Job; onChange: (job: Job) => void; onDelete: () => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [value, setValue] = useState(job.value === null ? "" : String(Math.round(job.value)));
  const patch = async (change: Parameters<typeof saveJob>[1]) => {
    const res = await saveJob(job.id, change);
    if (res.ok) {
      onChange(res.job);
      setProblem(null);
    } else setProblem(res.message);
  };
  return (
    <li className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`${PATHS.deals}/${job.id}`} className="text-[15px] font-medium text-ink hover:underline">
            {job.title}
          </Link>
          <p className="mt-0.5 truncate text-sm text-ink-2">{job.address || "No address yet"}</p>
        </div>
        {job.lat !== null ? (
          <Link href={`${PATHS.designer}?job=${job.id}`} className={ui.primary}>
            <PenTool className="size-4" aria-hidden /> {job.projectId ? "Open design" : "Design this roof"}
          </Link>
        ) : (
          <span className="text-xs text-muted">Add an address found on the map to design it</span>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className={ui.label}>
          Stage
          <select
            className={clsx(ui.input, "mt-1.5 appearance-auto")}
            value={job.stage}
            onChange={(e) => void patch({ stage: e.target.value as JobStage })}
          >
            {JOB_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.label}>
          Quoted price, inc. GST ($)
          <input
            className={clsx(ui.input, "mt-1.5 tabular-nums")}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
            onBlur={() => {
              const next = value === "" ? null : Number(value);
              if (next !== job.value) void patch({ value: next });
            }}
            placeholder="From the design"
          />
        </label>
        <label className={ui.label}>
          Install date
          <input
            type="date"
            className={clsx(ui.input, "mt-1.5 tabular-nums")}
            value={job.installDate ?? ""}
            onChange={(e) => void patch({ installDate: e.target.value || null })}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted" role="status">
          {problem ? <span className="text-danger">{problem}</span> : `Started ${shortDate(job.createdAt)}`}
        </p>
        <button
          onClick={() => window.confirm(`Delete the job "${job.title}"? Its design is kept.`) && onDelete()}
          className="text-xs font-medium text-muted underline underline-offset-4 hover:text-danger"
        >
          Delete job
        </button>
      </div>
    </li>
  );
}

/** /design/customers/[id]: one customer: their details, their jobs, and everything said and done. */
export function CustomerPage({ id }: { id: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerInput>(BLANK);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<"note" | "call" | "email">("note");
  const [text, setText] = useState("");
  const [newJob, setNewJob] = useState<{ title: string; address: string; lat: number | null; lng: number | null } | null>(null);

  const load = useCallback(async () => {
    const res = await loadCustomer(id);
    if (!res.ok) return setProblem(res.message);
    setCustomer(res.customer);
    setJobs(res.jobs);
    setActivity(res.activity);
    const c = res.customer;
    setDraft({
      name: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      source: c.source,
      notes: c.notes,
    });
  }, [id]);
  useEffect(() => {
    // The page's data comes from the server once it is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const changed =
    customer !== null &&
    (["firstName", "lastName", "phone", "email", "address", "source", "notes"] as const).some((k) => draft[k] !== customer[k]);

  const save = async () => {
    setStatus("Saving…");
    const res = await saveCustomer(id, draft);
    if (!res.ok) return setStatus(res.message);
    setCustomer(res.customer);
    setStatus("Saved");
  };
  const say = async () => {
    if (!text.trim()) return;
    const res = await addActivity(id, { kind, text: text.trim() });
    if (!res.ok) return setStatus(res.message);
    setActivity([res.activity, ...activity]);
    setText("");
  };
  const startJob = async () => {
    if (!newJob) return;
    const res = await createJob({ customerId: id, ...newJob, title: newJob.title.trim() || "Solar" });
    if (!res.ok) return setStatus(res.message);
    setJobs([res.job, ...jobs]);
    setNewJob(null);
  };

  if (problem)
    return (
      <div className={ui.page}>
        <Link href={PATHS.customers} className={clsx(ui.link, "text-sm")}>
          <ArrowLeft className="inline size-4" aria-hidden /> Customers
        </Link>
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      </div>
    );
  if (!customer) return <div className={ui.page} aria-busy="true" />;

  return (
    <div className={ui.page}>
      <Link href={PATHS.customers} className="text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink">
        <ArrowLeft className="inline size-3.5" aria-hidden /> Customers
      </Link>
      <div className="mt-3">
        <PageHead eyebrow={customer.sample ? "Customer · sample" : "Customer"} title={customer.name}>
          <button
            className={clsx(ui.quiet, "text-danger")}
            onClick={async () => {
              if (!window.confirm(`Delete ${customer.name}, their jobs and their history? Their designs are kept.`)) return;
              const res = await deleteCustomer(id);
              if (res.ok) router.push(PATHS.customers);
              else setStatus(res.message);
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </button>
        </PageHead>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className={clsx(ui.card, "p-5 sm:p-6")} aria-labelledby="jobs">
            <div className="flex items-center justify-between gap-3">
              <h2 id="jobs" className="text-[17px] tracking-tight text-ink">
                Jobs
              </h2>
              {!newJob && (
                <button
                  className={ui.quiet}
                  onClick={() => setNewJob({ title: "Solar", address: customer.address, lat: customer.lat, lng: customer.lng })}
                >
                  <Plus className="size-4" aria-hidden /> New job
                </button>
              )}
            </div>
            {newJob && (
              <div className="mt-4 rounded-md border border-line bg-canvas p-4">
                <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                  <label className={ui.label}>
                    What it is
                    <input
                      className={clsx(ui.input, "mt-1.5")}
                      value={newJob.title}
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      maxLength={80}
                      placeholder="Solar, Battery…"
                    />
                  </label>
                  <div className={ui.label}>
                    Where
                    <AddressField
                      value={newJob.address}
                      placed={newJob.lat !== null}
                      onChange={(place) => setNewJob({ ...newJob, ...place })}
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className={ui.primary} onClick={startJob}>
                    Start job
                  </button>
                  <button className={ui.quiet} onClick={() => setNewJob(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {jobs.length === 0 && !newJob ? (
              <p className="mt-3 text-sm text-ink-2">No jobs yet. Start one to design a roof and quote it.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onChange={(next) => {
                      setJobs(jobs.map((j) => (j.id === next.id ? next : j)));
                      // A change of stage is written to the history on the server: fetch it.
                      if (next.stage !== job.stage) void load();
                    }}
                    onDelete={async () => {
                      const res = await deleteJob(job.id);
                      if (res.ok) setJobs(jobs.filter((j) => j.id !== job.id));
                      else setStatus(res.message);
                    }}
                  />
                ))}
              </ul>
            )}
            {jobs.some((j) => j.value !== null) && (
              <p className="mt-3 text-xs tabular-nums text-muted">Quoted in all: {dollars(jobs.reduce((n, j) => n + (j.value ?? 0), 0))}</p>
            )}
          </section>

          <section className={clsx(ui.card, "p-5 sm:p-6")} aria-labelledby="history">
            <h2 id="history" className="text-[17px] tracking-tight text-ink">
              History
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                aria-label="What happened"
                className={clsx(ui.input, "w-28 appearance-auto")}
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
              </select>
              <input
                aria-label="What was said or done"
                className={clsx(ui.input, "min-w-0 flex-1")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void say()}
                maxLength={1000}
                placeholder="What was said or done"
              />
              <button className={ui.primary} onClick={say} disabled={!text.trim()}>
                Add
              </button>
            </div>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-ink-2">Nothing yet.</p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 w-12 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      {ACTIVITY_WORD[a.kind]}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-ink">{a.text}</span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                      {shortDate(a.at)}
                      <span className="block">{a.by.split("@")[0]}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className={clsx(ui.card, "p-5 sm:p-6 lg:sticky lg:top-6")} aria-labelledby="details">
          <h2 id="details" className="text-[17px] tracking-tight text-ink">
            Details
          </h2>
          <div className="mt-4">
            <CustomerFields value={draft} onChange={setDraft} narrow />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className={ui.primary} onClick={save} disabled={!changed}>
              Save details
            </button>
            <p className="text-xs text-muted" role="status">
              {status || `Added ${shortDate(customer.createdAt)}`}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
