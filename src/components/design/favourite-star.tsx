"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";
import { favouritesFirst, noFavourites, withFavourite, type FavouriteKind, type Favourites } from "@/lib/domain/design/favourites";
import { loadFavourites, setFavourite } from "@/lib/services/design-store";

/**
 * This person's favourite products in the designer's lists: read once as the designer opens, a star changed on the page
 * at once and kept (in their account, or on this device signed out), put back if it couldn't be kept.
 */
export function useFavourites() {
  const [favs, setFavs] = useState<Favourites>(noFavourites);
  useEffect(() => {
    let live = true;
    void loadFavourites().then((f) => live && setFavs(f));
    return () => {
      live = false;
    };
  }, []);
  const toggle = useCallback(
    (kind: FavouriteKind, sku: string) => {
      const on = !favs[kind].includes(sku);
      const before = favs;
      setFavs(withFavourite(favs, kind, sku, on));
      void setFavourite(before, kind, sku, on).then((kept) => setFavs(kept ?? before));
    },
    [favs],
  );
  const sorted = useCallback(
    <T extends { sku: string }>(kind: FavouriteKind, list: readonly T[]) => favouritesFirst(list, favs[kind]),
    [favs],
  );
  const is = useCallback((kind: FavouriteKind, sku: string) => favs[kind].includes(sku), [favs]);
  return { is, toggle, sorted };
}

/**
 * The star on a product's row: quiet until the row is pointed at (always there on a touch screen), and in the signal
 * colour once starred, since a starred product is one picked out.
 */
export function FavouriteStar({ on, onToggle, name }: { on: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={on}
      aria-label={on ? `Take ${name} off your favourites` : `Add ${name} to your favourites`}
      title={on ? "A favourite: shown first. Press to take it off" : "Add to favourites: shown first in this list"}
      className={clsx(
        "flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-surface-2",
        on
          ? "text-sun-line"
          : "text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
      )}
    >
      <Star className="size-4" fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
