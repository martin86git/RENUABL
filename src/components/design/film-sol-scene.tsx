"use client";

import { useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Mail, Users } from "lucide-react";
import { FILM } from "@/lib/domain/design/sales-page";
import { SolMark } from "./sol-icon";

/**
 * Sol's chapter of the hero film, played as a live chat (16 Nov 2026, Martin: as xAI's Grok Bot page shows its bots,
 * and its film closing in on each message). Drawn in the product's own look (the agents down the left, Sol's chat on
 * the charcoal) from `FILM.sol`, made-up people only. `ms` is the time into the scene; the camera closes in on each
 * line as it lands and draws back at the end to show the agents working beside him. Still (`still`), it shows the
 * whole of it.
 */

const S = FILM.sol;

/** When each part arrives, in ms from the scene's start. */
const AT = {
  opening: 400,
  ask: 2700,
  steps: 3500,
  answer: 6000,
  draft: 8600,
  send: 10200,
  choice: 11200,
  pick: 12600,
  done: 13300,
  wide: 14600,
  charlie: 6000,
} as const;
/** How long Sol takes to write each of his lines. */
const TYPE = { opening: 1700, answer: 2200, done: 700 } as const;
const STEP = 750;
export const SOL_SCENE_MS = 17000;

type Focus = "opening" | "ask" | "steps" | "answer" | "draft" | "choice" | "done" | "wide";

function focusAt(ms: number): Focus {
  if (ms >= AT.wide) return "wide";
  if (ms >= AT.done) return "done";
  if (ms >= AT.choice) return "choice";
  if (ms >= AT.draft) return "draft";
  if (ms >= AT.answer) return "answer";
  if (ms >= AT.steps) return "steps";
  if (ms >= AT.ask) return "ask";
  return "opening";
}

/**
 * A scene's camera: it closes in on the chat column (marked `data-camera-column`), filling the scene's width with it
 * so no line is cut and no sliver of the sidebar is left, and moves up and down to the part marked `data-focus` with
 * the given name, kept low with the lines before it above, its top kept in view. Measured again as that part grows (16 Nov 2026, Martin: measured while a line
 * was still being typed, the zoom grew past the frame and cut the words off). Draws back to the whole scene for any name
 * nothing is marked with. Shared by the film's scenes.
 */
export function useFocusCamera(focus: string, most = 1.75) {
  const root = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState("none");
  useLayoutEffect(() => {
    const box = root.current;
    const el = box?.querySelector<HTMLElement>(`[data-focus="${focus}"]`);
    if (!box || !el) return setCamera("none");
    const column = el.closest<HTMLElement>("[data-camera-column]") ?? el;
    // The chat's messages scroll as a chat does: the newest at the foot, older ones up out of sight.
    const scroller = box.querySelector<HTMLElement>("[data-camera-scroll]");
    const place = (n: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let p: HTMLElement | null = n; p && p !== box; p = p.offsetParent as HTMLElement | null) {
        x += p.offsetLeft;
        y += p.offsetTop;
      }
      for (let p = n.parentElement; p && p !== box; p = p.parentElement) y -= p.scrollTop;
      return { x, y };
    };
    const aim = () => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      const W = box.offsetWidth;
      const H = box.offsetHeight;
      const col = place(column);
      const at = place(el);
      const h = el.offsetHeight;
      const s = Math.max(1, Math.min(most, W / column.offsetWidth));
      const tx = Math.min(0, Math.max(W - W * s, W / 2 - (col.x + column.offsetWidth / 2) * s));
      // As a chat reads: the newest part low in the frame with what came before above it, but its top never under
      // the chapter's title.
      const low = 0.86 * H - (at.y + h) * s;
      const ty = Math.min(0, Math.max(H - H * s, Math.min(low, 0.14 * H - at.y * s)));
      setCamera(`translate(${tx}px, ${ty}px) scale(${s})`);
    };
    aim();
    const watch = new ResizeObserver(aim);
    watch.observe(el);
    if (scroller?.firstElementChild) watch.observe(scroller.firstElementChild);
    return () => watch.disconnect();
  }, [focus, most]);
  return [root, camera] as const;
}

export const typed = (text: string, ms: number, from: number, over: number) => {
  if (ms < from) return "";
  const n = Math.ceil(Math.min(1, (ms - from) / over) * text.length);
  return text.slice(0, n);
};

export function SolScene({ ms, still }: { ms: number; still?: boolean }) {
  const t = still ? SOL_SCENE_MS : ms;
  const shown = (at: number) => t >= at;
  const focus = still ? "wide" : focusAt(t);
  const [root, camera] = useFocusCamera(focus);

  const charlieBusy = shown(AT.charlie);
  const sent = shown(AT.send);
  const picked = shown(AT.pick);
  const text = "text-[clamp(9px,1.25cqw,19px)] leading-[1.5]";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#3a3d43]">
      <div
        ref={root}
        className={clsx(
          "absolute inset-0 flex origin-top-left",
          !still && "transition-transform duration-[1400ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
        )}
        style={{ transform: camera }}
      >
        {/* The agents, down the left. */}
        <aside className="flex w-[26%] shrink-0 flex-col bg-white px-[1.4cqw] py-[1.6cqw] text-ink">
          <div className="grid grid-cols-3 gap-[0.6cqw]">
            {S.agents.map((a) => {
              const busy = a.key === "charlie" && charlieBusy;
              return (
                <div
                  key={a.key}
                  className={clsx(
                    "flex flex-col items-center rounded-[1cqw] py-[0.9cqw] text-center",
                    a.key === "sol" && "bg-canvas ring-1 ring-line",
                  )}
                >
                  <AgentFace k={a.key} busy={busy} />
                  <span className="mt-[0.5cqw] text-[clamp(8px,0.95cqw,14px)] font-semibold">{a.name}</span>
                  <span className="text-[clamp(7px,0.75cqw,12px)] text-muted">{a.job}</span>
                </div>
              );
            })}
          </div>
          <ul className="mt-[1.6cqw] space-y-[1.2cqw]">
            {S.agents.map((a) => {
              const busy = a.key === "charlie" && charlieBusy && "busy" in a;
              return (
                <li key={a.key} className="flex items-start gap-[0.8cqw]">
                  <AgentFace k={a.key} small busy={busy} />
                  <span className="min-w-0">
                    <span className="block text-[clamp(8px,0.95cqw,14px)] font-semibold">{a.name}</span>
                    <span
                      className={clsx(
                        "block truncate text-[clamp(7px,0.85cqw,13px)] transition-colors duration-500",
                        busy ? "font-medium text-sun-line" : "text-muted",
                      )}
                    >
                      {busy && "busy" in a ? a.busy : a.preview}
                    </span>
                  </span>
                </li>
              );
            })}
            <li className="flex items-start gap-[0.8cqw]">
              <span className="grid size-[2.4cqw] shrink-0 place-items-center rounded-full bg-canvas ring-1 ring-line">
                <Users className="size-[1.2cqw] text-ink-2" />
              </span>
              <span className="min-w-0">
                <span className="block text-[clamp(8px,0.95cqw,14px)] font-semibold">{S.team.name}</span>
                <span className="block truncate text-[clamp(7px,0.85cqw,13px)] text-muted">{S.team.preview}</span>
              </span>
            </li>
          </ul>
          <p className="mt-auto text-[clamp(7px,0.85cqw,13px)] text-muted">{S.business}</p>
        </aside>

        {/* Sol's chat, on the charcoal. */}
        <section data-camera-column className="relative flex min-w-0 flex-1 flex-col text-white">
          <header className="flex items-center justify-center gap-[0.6cqw] py-[1.2cqw]">
            <SolMark className="size-[1.8cqw]" />
            <span className="text-[clamp(8px,1cqw,15px)] font-semibold">Sol</span>
          </header>
          <div data-camera-scroll className="min-h-0 flex-1 overflow-hidden px-[3cqw]">
            <div className="space-y-[1.5cqw] pb-[1cqw]">
              <p className="text-center text-[clamp(7px,0.85cqw,13px)] text-white/45">{S.when}</p>

              <div data-focus="opening" className="max-w-[78%]">
                <SolSays text={typed(S.opening, t, AT.opening, TYPE.opening)} className={text} />
              </div>

              {shown(AT.ask) && (
                <div data-focus="ask" className="film-pop flex justify-end">
                  <p className={clsx(text, "border-r border-white/60 pr-[1cqw] text-white")}>{S.ask}</p>
                </div>
              )}

              {shown(AT.steps) && (
                <div data-focus="steps" className="film-pop space-y-[0.4cqw]">
                  {S.steps.map((s, i) =>
                    shown(AT.steps + i * STEP) ? (
                      <p key={s} className={clsx(text, "film-pop flex items-center gap-[0.6cqw] text-white/60")}>
                        <Check className="size-[1.2cqw] text-sun-line" />
                        {s}
                      </p>
                    ) : null,
                  )}
                  {!shown(AT.answer) && (
                    <p className={clsx(text, "flex items-center gap-[0.6cqw] text-white/45")}>
                      <span className="film-pulse size-[0.7cqw] rounded-full bg-sun-line" />
                      {S.working}
                    </p>
                  )}
                </div>
              )}

              {shown(AT.answer) && (
                <div data-focus="answer" className="max-w-[82%]">
                  <SolSays text={typed(S.answer, t, AT.answer, TYPE.answer)} className={text} />
                </div>
              )}

              {shown(AT.draft) && (
                <div
                  data-focus="draft"
                  className="film-pop max-w-[70%] rounded-[1cqw] bg-white p-[1.4cqw] text-ink shadow-[0_1cqw_3cqw_-1cqw_rgba(0,0,0,0.5)]"
                >
                  <p className="flex items-center gap-[0.6cqw] text-[clamp(7px,0.8cqw,12px)] font-medium uppercase tracking-[0.14em] text-muted">
                    <Mail className="size-[1cqw]" />
                    {sent ? S.draft.sent : S.draft.label}
                  </p>
                  <p className="mt-[0.6cqw] text-[clamp(8px,0.9cqw,13px)] text-muted">{S.draft.to}</p>
                  <p className="text-[clamp(9px,1.1cqw,16px)] font-semibold">{S.draft.subject}</p>
                  <p className="mt-[0.4cqw] text-[clamp(8px,1cqw,15px)] leading-snug text-ink-2">{S.draft.body}</p>
                  <div className="mt-[1cqw] flex gap-[0.6cqw]">
                    <span
                      className={clsx(
                        "rounded-full px-[1.4cqw] py-[0.4cqw] text-[clamp(8px,0.95cqw,14px)] font-medium transition-all duration-300",
                        sent ? "bg-positive text-white" : "bg-ink text-white",
                        shown(AT.send - 300) && !sent && "scale-95 ring-[0.3cqw] ring-sun-line/50",
                      )}
                    >
                      {sent ? <Check className="inline size-[1.1cqw]" /> : S.draft.send}
                    </span>
                    {!sent && (
                      <span className="rounded-full px-[1.2cqw] py-[0.4cqw] text-[clamp(8px,0.95cqw,14px)] ring-1 ring-line">
                        {S.draft.edit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {shown(AT.choice) && (
                <div data-focus="choice" className="film-pop max-w-[62%] overflow-hidden rounded-[1cqw] ring-1 ring-white/25">
                  <p className={clsx(text, "px-[1.4cqw] py-[0.8cqw] font-semibold")}>{S.choice.ask}</p>
                  {S.choice.options.map((o, i) => (
                    <p
                      key={o}
                      className={clsx(
                        text,
                        "flex items-center gap-[1cqw] border-t border-white/15 px-[1.4cqw] py-[0.7cqw] transition-colors duration-300",
                        picked && i === 0 ? "bg-white/15" : "text-white/80",
                      )}
                    >
                      <span className="grid size-[1.8cqw] place-items-center rounded-full text-[clamp(7px,0.8cqw,12px)] ring-1 ring-white/30">
                        {i + 1}
                      </span>
                      {o}
                    </p>
                  ))}
                </div>
              )}

              {shown(AT.done) && (
                <div data-focus="done" className="film-pop max-w-[70%]">
                  <SolSays text={typed(S.done, t, AT.done, TYPE.done)} className={text} />
                </div>
              )}
            </div>
          </div>
          <div className="px-[2cqw] pb-[1.6cqw] pt-[1cqw]">
            <p className="rounded-full px-[1.6cqw] py-[0.9cqw] text-[clamp(8px,1cqw,15px)] text-white/40 ring-1 ring-white/20">{S.box}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SolSays({ text, className }: { text: string; className: string }) {
  return (
    <p className={clsx(className, "text-white")}>
      {text}
      <span className="ml-[0.1em] inline-block h-[1em] w-[0.08em] translate-y-[0.15em] bg-sun-line/80 align-baseline" aria-hidden />
    </p>
  );
}

/** Each agent's round: Sol's sun, the phone assistants' sound wave (orange while on a call). */
function AgentFace({ k, small, busy }: { k: string; small?: boolean; busy?: boolean }) {
  const size = small ? "size-[2.4cqw]" : "size-[4.2cqw]";
  if (k === "sol")
    return (
      <span className={clsx(size, "grid shrink-0 place-items-center")}>
        <SolMark className="size-full" />
      </span>
    );
  const tint = k === "charlie" ? "#ff5a1f" : "#2bb5a0";
  return (
    <span
      className={clsx(size, "relative grid shrink-0 place-items-center rounded-full bg-[#2a2c31]", busy && "film-ring")}
      style={busy ? { boxShadow: "0 0 0 0.25cqw rgba(255,90,31,0.8)" } : undefined}
    >
      <span className="flex h-[45%] items-center gap-[10%]">
        {[0.45, 0.8, 1, 0.65, 0.4].map((v, i) => (
          <span
            key={i}
            className={clsx("w-[0.22cqw] rounded-full", busy && "film-wave")}
            style={{ height: `${v * 100}%`, background: tint, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
    </span>
  );
}
