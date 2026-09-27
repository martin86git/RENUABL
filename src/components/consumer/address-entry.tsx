"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { parseAddress, searchAddresses } from "@/lib/services/consumer";
import type { Address } from "@/lib/domain/types";
import { formatAddress } from "@/lib/mock/addresses";
import { cn } from "@/components/ui/primitives";
import { useFlow } from "./flow-state";
import { stepHref } from "./steps";

export function AddressEntry({ className }: { className?: string }) {
  const router = useRouter();
  const { update } = useFlow();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const suggestions = searchAddresses(query);
  const showList = focused && suggestions.length > 0;

  function go(address: Address) {
    update({ address });
    router.push(stepHref("profile"));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) return go(suggestions[active]);
    const parsed = suggestions[0] ?? parseAddress(query);
    if (!parsed) {
      setError("Enter your street address to get started.");
      return;
    }
    go(parsed);
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full", className)} role="search">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Your home address
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-[var(--shadow-lift)] focus-within:border-ink">
        <MapPin className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="street-address"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(suggestions.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            }
          }}
          placeholder="Enter your home address"
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted focus-visible:outline-none"
        />
        <button
          type="submit"
          className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-canvas transition hover:opacity-90 active:scale-[0.98]"
        >
          <span className="hidden sm:inline">Get started</span>
          <ArrowRight className="h-5 w-5" />
          <span className="sr-only sm:hidden">Get started</span>
        </button>
      </div>
      {error && (
        <p className="mt-2 pl-5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-3xl border border-line bg-surface py-2 shadow-[var(--shadow-lift)]"
        >
          {suggestions.map((a, i) => (
            <li
              key={formatAddress(a)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(a);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-5 py-3 text-[15px]",
                i === active ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <MapPin className="h-4 w-4 text-muted" aria-hidden />
              <span>
                {a.line}
                <span className="text-muted">
                  , {a.suburb} {a.state} {a.postcode}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
