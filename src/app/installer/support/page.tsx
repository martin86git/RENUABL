import { MessageCircle, Phone, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/installer/bits";

export const metadata = { title: "Support" };

const OPTIONS = [
  { icon: Phone, title: "Installer hotline", body: "Technical and on-site support, 6am–8pm, 7 days." },
  { icon: MessageCircle, title: "Partner success", body: "Payments, matching and account questions." },
  { icon: TriangleAlert, title: "Report a safety incident", body: "Immediate escalation to the RENUABL safety team." },
];

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support" subtitle="We're here for your crews in the field and your team in the office" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {OPTIONS.map(({ icon: Icon, title, body }) => (
          <button
            key={title}
            type="button"
            className="min-h-28 rounded-2xl border border-line bg-surface p-5 text-left hover:border-line-strong"
          >
            <Icon className="h-5 w-5 text-muted" aria-hidden />
            <p className="mt-3 text-[16px] font-semibold">{title}</p>
            <p className="mt-1 text-[14px] text-muted">{body}</p>
          </button>
        ))}
      </div>
    </>
  );
}
