import { watchRoute } from "@/lib/server/design-watch-route";

/** POST { id, on }: this person watches a job listing, or stops. */
export const POST = watchRoute("listing");
