"use client";

import clsx from "clsx";
import { Hash } from "lucide-react";
import { FILM } from "@/lib/domain/design/sales-page";
import { SolMark } from "./sol-icon";
import { typed, useFocusCamera } from "./film-sol-scene";

/**
 * Team chat with Sol asked in (16 Nov 2026, Martin: "show chat to the team, and invite Sol to the conversation… talking
 * with a colleague and then loop in sol for a question on battery locations"). Drawn in the product's team chat look
 * from `FILM.team`: the channels down the left, the Installations channel open, Sam asking about Jane Doe's garage, you
 * not sure and asking @Sol, Sol answering in the channel with the clearances and a drawing, and Sam taking it from
 * there. `ms` is the time into the scene; the camera closes in on each line as it lands. Used by the hero film and the
 * upgrade deck's team card.
 */

const T = FILM.team;

const AT = {
  first: 300,
  second: 2400,
  ask: 3700,
  joining: 5600,
  answer: 6600,
  drawing: 9400,
  caveat: 11200,
  thanks: 12800,
  wide: 14400,
} as const;
const TYPE_ASK = 1300;
const TYPE_ANSWER = 2600;
export const TEAM_SCENE_MS = 16500;

type Focus = "first" | "talk" | "answer" | "drawing" | "thanks" | "wide";

function focusAt(ms: number): Focus {
  if (ms >= AT.wide) return "wide";
  if (ms >= AT.thanks) return "thanks";
  if (ms >= AT.drawing) return "drawing";
  if (ms >= AT.joining) return "answer";
  if (ms >= AT.second) return "talk";
  return "first";
}

export function TeamScene({ ms, still }: { ms: number; still?: boolean }) {
  const t = still ? TEAM_SCENE_MS : ms;
  const shown = (at: number) => t >= at;
  const [root, camera] = useFocusCamera(still ? "wide" : focusAt(t), 1.6);
  const text = "text-[clamp(9px,1.2cqw,18px)] leading-[1.5]";
  const name = "text-[clamp(8px,0.9cqw,13px)] font-semibold";
  const when = "text-[clamp(7px,0.8cqw,12px)] font-normal text-muted";

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div
        ref={root}
        className={clsx(
          "absolute inset-0 flex origin-top-left",
          !still && "transition-transform duration-[1400ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
        )}
        style={{ transform: camera }}
      >
        {/* Channels and people, down the left. */}
        <aside className="w-[22%] shrink-0 bg-canvas px-[1.4cqw] py-[1.8cqw] text-ink">
          <p className="text-[clamp(7px,0.8cqw,12px)] font-semibold uppercase tracking-[0.16em] text-muted">Channels</p>
          <ul className="mt-[0.8cqw] space-y-[0.3cqw]">
            {T.channels.map((c) => (
              <li
                key={c}
                className={clsx(
                  "flex items-center gap-[0.5cqw] rounded-[0.6cqw] px-[0.7cqw] py-[0.45cqw] text-[clamp(8px,1cqw,15px)]",
                  c === T.channel ? "bg-white font-semibold shadow-sm ring-1 ring-line" : "text-ink-2",
                )}
              >
                <Hash className="size-[1cqw] text-muted" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-[1.8cqw] text-[clamp(7px,0.8cqw,12px)] font-semibold uppercase tracking-[0.16em] text-muted">Direct messages</p>
          <ul className="mt-[0.8cqw] space-y-[0.6cqw]">
            {T.people.map((p) => (
              <li key={p} className="flex items-center gap-[0.6cqw] px-[0.7cqw] text-[clamp(8px,1cqw,15px)] text-ink-2">
                <Initial who={p} />
                {p}
              </li>
            ))}
          </ul>
        </aside>

        {/* The channel. */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-[0.5cqw] border-b border-line px-[2.4cqw] py-[1.2cqw] text-[clamp(9px,1.1cqw,16px)] font-semibold text-ink">
            <Hash className="size-[1.2cqw] text-muted" />
            {T.channel}
          </header>
          <div className="flex-1 space-y-[1.4cqw] overflow-hidden px-[2.4cqw] py-[1.6cqw] text-ink">
            {shown(AT.first) && (
              <div data-focus="first" className="film-pop flex max-w-[78%] gap-[0.8cqw]">
                <Initial who={T.sam} />
                <div>
                  <p className={name}>
                    {T.sam} <span className={when}>9:12 am</span>
                  </p>
                  <p className={clsx(text, "mt-[0.3cqw] rounded-[1cqw] rounded-tl-[0.3cqw] bg-canvas px-[1.2cqw] py-[0.7cqw]")}>
                    {T.first}
                  </p>
                </div>
              </div>
            )}

            {shown(AT.second) && (
              <div data-focus="talk" className="film-pop ml-auto flex max-w-[70%] flex-col items-end gap-[0.4cqw]">
                <p className={name}>
                  {T.you} <span className={when}>9:13 am</span>
                </p>
                <p className={clsx(text, "rounded-[1cqw] rounded-tr-[0.3cqw] bg-primary px-[1.2cqw] py-[0.7cqw] text-white")}>{T.second}</p>
                {shown(AT.ask) && (
                  <p className={clsx(text, "film-pop rounded-[1cqw] rounded-tr-[0.3cqw] bg-primary px-[1.2cqw] py-[0.7cqw] text-white")}>
                    <span className="rounded-[0.3cqw] bg-sun-line px-[0.3cqw] font-semibold">{T.tag}</span>{" "}
                    {typed(T.ask, t, AT.ask + 300, TYPE_ASK)}
                  </p>
                )}
              </div>
            )}

            {shown(AT.joining) && (
              <div data-focus="answer" className="film-pop flex max-w-[86%] gap-[0.8cqw]">
                <span className="grid size-[2.6cqw] shrink-0 place-items-center">
                  <SolMark className="size-full" />
                </span>
                <div className="min-w-0">
                  <p className={name}>
                    Sol <span className={when}>9:13 am</span>
                  </p>
                  {shown(AT.answer) ? (
                    <div className="mt-[0.3cqw] rounded-[1cqw] rounded-tl-[0.3cqw] bg-sun px-[1.2cqw] py-[0.8cqw]">
                      <p className={text}>{typed(T.answer, t, AT.answer, TYPE_ANSWER)}</p>
                      {shown(AT.caveat) && <p className={clsx(text, "film-pop mt-[0.6cqw] text-ink-2")}>{T.caveat}</p>}
                    </div>
                  ) : (
                    <p className={clsx(text, "mt-[0.3cqw] flex items-center gap-[0.6cqw] text-muted")}>
                      <span className="film-pulse size-[0.7cqw] rounded-full bg-sun-line" />
                      {T.joining}
                    </p>
                  )}
                  {shown(AT.drawing) && (
                    <div data-focus="drawing" className="film-pop mt-[0.8cqw] max-w-[34cqw]">
                      <WallDrawing />
                    </div>
                  )}
                </div>
              </div>
            )}

            {shown(AT.thanks) && (
              <div data-focus="thanks" className="film-pop flex max-w-[70%] gap-[0.8cqw]">
                <Initial who={T.sam} />
                <div>
                  <p className={name}>
                    {T.sam} <span className={when}>9:14 am</span>
                  </p>
                  <p className={clsx(text, "mt-[0.3cqw] rounded-[1cqw] rounded-tl-[0.3cqw] bg-canvas px-[1.2cqw] py-[0.7cqw]")}>
                    {T.thanks}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="px-[2.4cqw] pb-[1.6cqw]">
            <p className="rounded-[1cqw] px-[1.4cqw] py-[0.9cqw] text-[clamp(8px,1cqw,15px)] text-muted ring-1 ring-line">{T.box}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Initial({ who }: { who: string }) {
  return (
    <span className="grid size-[2.6cqw] shrink-0 place-items-center rounded-full bg-primary text-[clamp(8px,1cqw,14px)] font-semibold text-white">
      {who.slice(0, 1)}
    </span>
  );
}

/** Sol's drawing of the wall: the door and window with their no-battery zones, and the battery on the clear stretch. */
function WallDrawing() {
  return (
    <figure className="overflow-hidden rounded-[0.8cqw] bg-white ring-1 ring-line">
      <figcaption className="border-b border-line px-[1cqw] py-[0.5cqw] text-[clamp(7px,0.8cqw,12px)] font-medium uppercase tracking-[0.12em] text-muted">
        {T.drawing}
      </figcaption>
      <svg viewBox="0 0 320 150" className="block w-full" role="img" aria-label={T.drawing}>
        <rect x="10" y="10" width="300" height="130" fill="#f4f1ec" stroke="#3a3d43" strokeWidth="1.5" />
        {/* No-go zones. */}
        <rect x="22" y="10" width="86" height="130" fill="#e8b4ad" opacity="0.65" />
        <rect x="186" y="10" width="112" height="118" fill="#e8b4ad" opacity="0.65" />
        {/* Door and window. */}
        <rect x="44" y="52" width="42" height="88" fill="#7b6a63" />
        <text x="65" y="98" textAnchor="middle" fontSize="9" fill="#fff">
          {T.door}
        </text>
        <rect x="208" y="26" width="68" height="44" fill="#b8d3ef" stroke="#3a3d43" />
        <text x="242" y="51" textAnchor="middle" fontSize="9" fill="#1d1d1f">
          {T.window}
        </text>
        <text x="65" y="24" textAnchor="middle" fontSize="8" fill="#7a2e22">
          {T.noGo}
        </text>
        <text x="242" y="118" textAnchor="middle" fontSize="8" fill="#7a2e22">
          {T.noGo}
        </text>
        {/* The battery on the clear wall. */}
        <rect x="128" y="74" width="40" height="56" rx="3" fill="#2f7d4f" />
        <text x="148" y="105" textAnchor="middle" fontSize="8" fill="#fff">
          {T.battery}
        </text>
        {/* 600 mm marks. */}
        <g stroke="#3a3d43" strokeWidth="1" fontSize="7" fill="#3a3d43">
          <line x1="86" y1="44" x2="108" y2="44" />
          <text x="97" y="40" textAnchor="middle" stroke="none">
            600
          </text>
          <line x1="186" y1="20" x2="208" y2="20" />
          <text x="197" y="17" textAnchor="middle" stroke="none">
            600
          </text>
          <line x1="242" y1="70" x2="242" y2="128" />
          <text x="252" y="102" stroke="none">
            900
          </text>
        </g>
      </svg>
    </figure>
  );
}
