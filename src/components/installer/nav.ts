import {
  BookOpen,
  Briefcase,
  CalendarRange,
  ChartColumn,
  Ellipsis,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Package,
  ShieldCheck,
  Sun,
  Users,
  Wallet,
} from "lucide-react";

export const INSTALLER_NAV = [
  { href: "/installer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/installer/jobs", label: "Jobs", icon: Briefcase },
  { href: "/installer/schedule", label: "Calendar", icon: CalendarRange },
  { href: "/installer/materials", label: "Materials", icon: Package },
  { href: "/installer/customers", label: "Customers", icon: Users },
  { href: "/installer/messages", label: "Messages", icon: MessageCircle },
  { href: "/installer/documents", label: "Documents", icon: FileText },
  { href: "/installer/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/installer/performance", label: "Performance", icon: ChartColumn },
  { href: "/installer/payments", label: "Payments", icon: Wallet },
  { href: "/installer/resources", label: "Resources", icon: BookOpen },
  { href: "/installer/support", label: "Support", icon: LifeBuoy },
] as const;

/** Field app: execution, not administration. */
export const INSTALLER_MOBILE_NAV = [
  { href: "/installer", label: "Today", icon: Sun },
  { href: "/installer/jobs", label: "Jobs", icon: Briefcase },
  { href: "/installer/messages", label: "Messages", icon: MessageCircle },
  { href: "/installer/more", label: "More", icon: Ellipsis },
] as const;

export function isNavActive(pathname: string, href: string) {
  return href === "/installer" ? pathname === "/installer" : pathname.startsWith(href);
}
