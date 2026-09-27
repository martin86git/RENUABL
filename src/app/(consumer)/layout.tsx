import { FlowProvider } from "@/components/consumer/flow-state";

/** Shared across home and the guided flow so answers survive navigation. */
export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return <FlowProvider>{children}</FlowProvider>;
}
