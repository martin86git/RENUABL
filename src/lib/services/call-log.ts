/** The call log on Today (domain/design/call-log.ts), as the screen asks for it. */
import type { CallComing, CallLogEntry } from "@/lib/domain/design/call-log";
import { ask } from "./crm";

export const loadCallLog = () => ask<{ calls: CallLogEntry[]; coming: CallComing[]; solOn: boolean }>("/api/design/calls");
