/** Today's Business and My month (domain/design/insights.ts), as the page asks for them. */
import type { InsightsView } from "@/lib/domain/design/insights";
import { ask } from "./crm";

export const loadInsights = () => ask<{ views: InsightsView[] }>("/api/design/insights");
