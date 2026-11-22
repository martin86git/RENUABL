"use client";

/**
 * A team member's round: their own profile photo when they have one (design-member-photos.ts), else their initials on
 * a colour from their email. One drawing for team chat, the account page and wherever the team is shown.
 */
import clsx from "clsx";
import { createContext, useContext, useState } from "react";
import { callerTint } from "@/lib/domain/design/caller";
import { initialsOf } from "@/lib/domain/design/team-chat";
import { memberPhotoUrl } from "@/lib/services/design-account";

/** Who has a photo, by email, with its version: given once by the page (team chat's view, the members list). */
export const MemberPhotos = createContext<Record<string, number>>({});

export function MemberAvatar({
  email,
  photo,
  className = "size-7 text-[10.5px]",
  plain = false,
}: {
  email: string;
  /** The photo's version; left out, it is looked up in `MemberPhotos`. */
  photo?: number | null;
  className?: string;
  /** Initials on the graphite, not a colour of their own (where many sit together on a busy line). */
  plain?: boolean;
}) {
  const known = useContext(MemberPhotos);
  const version = photo === undefined ? known[email.toLowerCase()] : photo;
  const [broken, setBroken] = useState<number | null>(null);
  const showPhoto = !!version && broken !== version;
  return (
    <span
      aria-hidden
      className={clsx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        className,
      )}
      style={showPhoto || plain ? undefined : { background: `var(--caller-${callerTint(email)})` }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={memberPhotoUrl(email, version)} alt="" className="size-full object-cover" onError={() => setBroken(version)} />
      ) : (
        <span className={plain ? "flex size-full items-center justify-center bg-primary" : undefined}>{initialsOf(email)}</span>
      )}
    </span>
  );
}
