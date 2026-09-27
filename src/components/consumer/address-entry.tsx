"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { inLaunchMarket, type AddressSuggestion } from "@/lib/domain/address";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import type { Address } from "@/lib/domain/types";
import { parseAddress, resolveAddress, suggestAddresses } from "@/lib/services/consumer";
import { cn } from "@/components/ui/primitives";
import { useFlow } from "./flow-state";
import { stepHref } from "./steps";

function newSession() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

export function AddressEntry({ className }: { className?: string }) {
  const router = useRouter();
  const { update } = useFlow();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [source, setSource] = useState<"google" | "sample">("google");
  const [busy, setBusy] = useState(false);
  // One Places "session" per search, ended by picking an address (keeps Google billing per search, not per keystroke).
  const session = useRef(newSession());
  const listId = useId();
  const showList = focused && suggestions.length > 0;

  useEffect(() => {
    if (query.trim().length < 3) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const result = await suggestAddresses(query, session.current, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(result.suggestions);
        setSource(result.source);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  function go(address: Address) {
    if (!inLaunchMarket(address)) {
      setError(`We're starting in ${LAUNCH_MARKET.name}. We'll be in your state soon.`);
      return;
    }
    update({ address });
    router.push(stepHref("analysing"));
  }

  async function pick(s: AddressSuggestion) {
    setBusy(true);
    const address = await resolveAddress(s.id, session.current);
    session.current = newSession();
    setBusy(false);
    if (!address) {
      setError("We couldn't find that exact address. Please pick your street address from the list.");
      return;
    }
    go(address);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const chosen = suggestions[active >= 0 ? active : 0];
    if (chosen) return void pick(chosen);
    // Previews without Google keep working with typed addresses.
    const parsed = source === "sample" ? parseAddress(query) : null;
    if (parsed) return go(parsed);
    setError("Start typing your street address, then pick it from the list.");
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full", className)} role="search">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Your home address
      </label>
      <div className="flex items-center gap-2 rounded-full bg-surface p-1.5 pl-5 shadow-[var(--shadow-lift)] ring-1 ring-line focus-within:ring-ink/40">
        <MapPin className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.5} aria-hidden />
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
            if (e.target.value.trim().length < 3) setSuggestions([]);
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
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/90 focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Get started"
          disabled={busy}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-ink transition hover:opacity-90 active:scale-[0.97]"
        >
          <ArrowRight className="h-5 w-5" strokeWidth={1.6} />
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
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-3xl bg-surface py-2 shadow-[var(--shadow-lift)] ring-1 ring-line"
        >
          {suggestions.map((sg, i) => (
            <li
              key={sg.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(sg);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-5 py-3 text-[15px]",
                i === active ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 truncate">
                {sg.main}
                {sg.secondary && <span className="text-muted">, {sg.secondary}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
