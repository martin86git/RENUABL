"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { inLaunchMarket, outsideMarketMessage, type AddressSuggestion } from "@/lib/domain/address";
import type { LandingKey } from "@/lib/domain/landing";
import type { Address } from "@/lib/domain/types";
import { parseAddress, resolveAddress, suggestAddresses } from "@/lib/services/consumer";
import { cn } from "@/components/ui/primitives";
import { useFlow } from "./flow-state";
import { stepHref } from "./steps";

function newSession() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

/**
 * The address box. By default a chosen address starts the plan; `onPick` hands it back instead (the guided brief).
 * A landing page passes `entry`: the plan remembers where it started and wants a battery from the start.
 */
export function AddressEntry({
  className,
  onPick,
  entry,
  compact,
  placeholder,
}: {
  className?: string;
  onPick?: (address: Address) => void;
  entry?: LandingKey;
  /** A slimmer box for a tool's header bar (the roof designer), in place of the home page's large one. */
  compact?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const { state, update } = useFlow();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [outside, setOutside] = useState<{ title: string; body: string } | null>(null);
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
      setError(null);
      // Close the list (it isn't searched again until they type).
      setSuggestions([]);
      setOutside(outsideMarketMessage(address));
      return;
    }
    setOutside(null);
    if (entry === "battery")
      // "Got solar? Add a battery": "Would you like a battery?" starts as yes, leading with the battery option.
      update({ address, entry, profile: { ...state.profile, wantsBattery: true }, tier: "recommended", config: null });
    else update({ address });
    if (onPick) onPick(address);
    else router.push(stepHref("analysing"));
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
      <div
        className={cn(
          "flex items-center bg-surface ring-1 ring-line focus-within:ring-ink/40",
          compact ? "gap-1.5 rounded-md p-0.5 pl-3" : "gap-2 rounded-full p-1.5 pl-5 shadow-[var(--shadow-lift)]",
        )}
      >
        <MapPin className={cn("shrink-0 text-ink-2", compact ? "h-4 w-4" : "h-5 w-5")} strokeWidth={1.5} aria-hidden />
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
            setOutside(null);
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
          placeholder={placeholder ?? "Enter your home address"}
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/90 focus-visible:outline-none",
            compact ? "h-9 text-sm" : "h-12 text-[16px]",
          )}
        />
        <button
          type="submit"
          aria-label="Get started"
          disabled={busy}
          className={cn(
            "grid shrink-0 place-items-center bg-primary text-primary-ink transition hover:opacity-90 active:scale-[0.97]",
            compact ? "h-9 w-9 rounded" : "h-12 w-12 rounded-full",
          )}
        >
          <ArrowRight className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.6} />
        </button>
      </div>
      {error && (
        <p className="mt-2 pl-5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      {outside && (
        <div className="mt-3 rounded-2xl bg-surface-2 px-5 py-4 text-left" role="status">
          <p className="text-[15px] text-ink">{outside.title}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{outside.body}</p>
        </div>
      )}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            "absolute left-0 top-full z-40 mt-2 overflow-hidden bg-surface py-2 shadow-[var(--shadow-lift)] ring-1 ring-line",
            compact ? "w-[26rem] max-w-[90vw] rounded-lg" : "right-0 rounded-3xl",
          )}
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
