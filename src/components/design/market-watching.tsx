"use client";

import { todayInMarket } from "@/lib/domain/market";
import { ListingCard } from "./marketplace";
import { WatchingPage } from "./market-watch";
import { ItemCard } from "./trade";

/** The Watching page, with the Marketplace's own cards for jobs and equipment. */
export function WatchingScreen() {
  const today = todayInMarket();
  return (
    <WatchingPage
      renderJob={(l) => <ListingCard listing={l} km={l.km} today={today} />}
      renderItem={(i) => <ItemCard item={i} km={i.km} />}
    />
  );
}
