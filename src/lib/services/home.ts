/**
 * Post-install household service ("My RENUABL"). This is the long-term
 * relationship surface: telemetry → insights → upgrades.
 */
import { buildServiceAvailability, type ServiceReasonId } from "@/lib/domain/service";
import { EXAMPLE_INSTALLATION } from "@/lib/mock/installation";
import { HEALTH, HOME_SYSTEM, INSIGHTS, MONTH_SUMMARY, TODAY, TODAY_CURVE, UPGRADES, WEEK } from "@/lib/mock/home-energy";

export function getHousehold() {
  return HOME_SYSTEM;
}

export function getToday() {
  return { ...TODAY, curve: TODAY_CURVE };
}

export function getWeek() {
  return WEEK;
}

export function getMonthSummary() {
  return MONTH_SUMMARY;
}

export function getInsights() {
  return INSIGHTS;
}

export function getSystemHealth() {
  return HEALTH;
}

export function getUpgrades() {
  return UPGRADES;
}

export function getServiceAvailability(from = new Date()) {
  return buildServiceAvailability(HOME_SYSTEM.installerId, from);
}

export interface ServiceRequest {
  reason: ServiceReasonId;
  details: string;
  photos: number;
  date: string;
  windowId: string;
}

export interface ServiceBooking extends ServiceRequest {
  reference: string;
  installer: string;
}

/** Mock: in production this creates a service job in the installer portal and notifies the customer. */
export async function requestService(req: ServiceRequest): Promise<ServiceBooking> {
  await new Promise((r) => setTimeout(r, 800));
  return { ...req, reference: `SV-${Math.floor(1000 + Math.random() * 9000)}`, installer: HOME_SYSTEM.installer };
}

/** The example home's installation record (until customers have their own). */
export function getExampleInstallation() {
  return EXAMPLE_INSTALLATION;
}
