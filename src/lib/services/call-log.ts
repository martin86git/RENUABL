/** The call log on Today (domain/design/call-log.ts), as the screen asks for it. */
import type { CallComing, CallLogEntry } from "@/lib/domain/design/call-log";
import { ask } from "./crm";
import { warm, warmed } from "./warm";

type CallLog = { calls: CallLogEntry[]; coming: CallComing[]; solOn: boolean };
export const loadCallLog = () => warm("calls", () => ask<CallLog>("/api/design/calls"));
/** The last call log read this visit, so Today's Calls tab opens on it. */
export const keptCallLog = () => warmed<{ ok: true } & CallLog>("calls");
