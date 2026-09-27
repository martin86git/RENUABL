import { FlowShell } from "@/components/consumer/flow-shell";

export default function StartLayout({ children }: LayoutProps<"/start">) {
  return <FlowShell>{children}</FlowShell>;
}
