"use client";

import { useEffect, useState } from "react";
import { loadMembers } from "@/lib/services/design-account";
import { useDesignAccount } from "./design-account";

/** A member's email as a name to choose from: the part before the @, as the deal cards show an owner. */
const handle = (email: string) => email.split("@")[0];

/**
 * "Assign to:" on every new deal's form (18 Nov 2026, Martin: a new lead's box needs who to assign it to, as a
 * dropdown). Empty is the business's own lead rule (Today → New in: kept by whoever adds it, or given in turns); else
 * one of its people, checked on the server. Shown only while the business has more than one person to choose from.
 */
export function AssignTo({
  value,
  onChange,
  className,
  selectClassName,
}: {
  value: string;
  onChange: (email: string) => void;
  className?: string;
  selectClassName?: string;
}) {
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const [people, setPeople] = useState<string[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadMembers().then((m) => !gone && setPeople(m ? m.map((x) => x.email.toLowerCase()) : []));
    return () => {
      gone = true;
    };
  }, []);
  if (!people || people.length < 2) return null;
  // You first, then everyone else by name.
  const listed = [...people].sort((a, b) => (a === me ? -1 : b === me ? 1 : handle(a).localeCompare(handle(b))));
  return (
    <label className={className}>
      Assign to
      <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Your lead rule decides</option>
        {listed.map((p) => (
          <option key={p} value={p}>
            {p === me ? `Me (${handle(p)})` : handle(p)}
          </option>
        ))}
      </select>
    </label>
  );
}
