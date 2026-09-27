/**
 * Post-install household service ("My RENUABL"). This is the long-term
 * relationship surface: telemetry → insights → upgrades.
 */
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
