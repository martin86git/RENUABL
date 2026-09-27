/** Server only. Reads what's kept with jobs' installation records (e.g. approved variations for payouts). */
import type { Variation } from "@/lib/domain/variations";
import { getRecord, validKey } from "./handover-store";
import { storageConfigured } from "./storage";

/** Variations by record key. Empty when storage isn't set up or a record can't be read. */
export async function variationsFor(keys: string[]): Promise<Record<string, Variation[]>> {
  if (!storageConfigured()) return {};
  const entries = await Promise.all(
    keys.filter(validKey).map(async (k) => {
      try {
        return [k, (await getRecord(k))?.variations ?? []] as const;
      } catch {
        return [k, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
