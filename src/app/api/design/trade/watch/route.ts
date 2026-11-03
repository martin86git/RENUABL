import { watchRoute } from "@/lib/server/design-watch-route";

/** POST { id, on }: this person watches an item of equipment, or stops. */
export const POST = watchRoute("item");
