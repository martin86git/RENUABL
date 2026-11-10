"use client";

/**
 * The home's day in the designer (10 Nov 2026, Martin: the roof design is one dimension; the second is time). The
 * design played through a day: the sun crossing the roof with each panel lighting as the sun reaches it, and under
 * it what the panels make, what the home uses, the battery filling and emptying and what the grid still supplies,
 * for a summer, an autumn or a winter day. Worked out in the browser from what the designer already holds (rules in
 * domain/design/home-day.ts): nothing is asked of a server. A modelled day, and it says so.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Pause, Play, X } from "lucide-react";
import {
  DAY_NOTE,
  DAY_NOTE_YOURS,
  DAY_NO_BILL,
  DAY_SEASONS,
  DAY_STEPS,
  clockWords,
  dayWords,
  homeDay,
  momentWords,
  type DayPanel,
  type DaySeason,
  type DayStep,
  type HomeDay,
} from "@/lib/domain/design/home-day";
import { heightAt, shadedAt, type SunPosition, type Terrain } from "@/lib/domain/design/shade";
import { MONTH_DAYS } from "@/lib/domain/design/tilt";
import { ASSUMPTIONS } from "@/lib/domain/recommendation";

type Px = readonly [number, number];

/** How long a half hour of the day lasts while it plays, in milliseconds: a day in about eight seconds. */
const TICK_MS = 170;

export interface HomeDayArgs {
  latitude: number;
  /** Every panel standing on the roof, with where it is (the designer's metres from the middle of the picture). */
  panels: readonly (DayPanel & { x: number; y: number })[];
  /** What the design makes in each month, kWh (January first). */
  monthKwh: readonly number[];
  homeDayKwh: number | null;
  /** The battery's size less anything held for blackouts, kWh. */
  batteryKwh: number;
  /** The heights round the roof, when they are to hand: what stands in the sun's way. */
  terrain: Terrain | null;
}

export interface HomeDayState {
  on: boolean;
  open: () => void;
  close: () => void;
  season: DaySeason;
  setSeason: (season: DaySeason) => void;
  at: number;
  setAt: (step: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  day: HomeDay | null;
  step: DayStep | null;
}

const stillPlease = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The day's state for the designer: whether it is showing, which season, the moment, and the day itself worked out. */
export function useHomeDay(args: HomeDayArgs, startOn = false): HomeDayState {
  const [on, setOn] = useState(startOn);
  const [season, setSeason] = useState<DaySeason>("summer");
  const [at, setAt] = useState(26);
  const [playing, setPlaying] = useState(false);
  const month = DAY_SEASONS.find((s) => s.id === season)?.month ?? 0;
  const dayKwh = (args.monthKwh[month] ?? 0) / MONTH_DAYS[month];
  const panelsKey = args.panels.map((p) => `${p.kw},${p.tilt},${Math.round(p.facing)},${p.x},${p.y}`).join("|");
  const terrain = args.terrain;
  const day = useMemo(
    () =>
      on
        ? homeDay({
            latitude: args.latitude,
            month,
            panels: args.panels,
            dayKwh,
            homeDayKwh: args.homeDayKwh,
            batteryKwh: Math.max(0, args.batteryKwh) * ASSUMPTIONS.batteryUsableShare,
            // A panel sits a little above the roof under it, as the shade analysis takes it to.
            ...(terrain
              ? {
                  shaded: (n: number, sun: SunPosition) => {
                    const panel = args.panels[n];
                    return shadedAt(terrain, panel.x, panel.y, heightAt(terrain, panel.x, panel.y) + 0.15, sun);
                  },
                }
              : {}),
          })
        : null,
    // The panels are stood for by their key, which changes exactly when any of them does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, month, panelsKey, dayKwh, args.homeDayKwh, args.batteryKwh, terrain, args.latitude],
  );
  useEffect(() => {
    if (!on || !playing) return;
    const timer = window.setInterval(() => setAt((now) => (now + 1) % DAY_STEPS), TICK_MS);
    return () => window.clearInterval(timer);
  }, [on, playing]);
  const open = () => {
    setOn(true);
    // It opens just before the sun comes up and plays, or stands at midday for someone who asked for no motion.
    const still = stillPlease();
    setAt(still ? 26 : 10);
    setPlaying(!still);
  };
  return {
    on,
    open,
    close: () => {
      setOn(false);
      setPlaying(false);
    },
    season,
    setSeason,
    at,
    setAt: (step) => setAt(Math.max(0, Math.min(DAY_STEPS - 1, Math.round(step)))),
    playing,
    setPlaying,
    day,
    step: day ? (day.steps[at] ?? null) : null,
  };
}

const join = (points: readonly Px[]) => points.map((p) => p.join(",")).join(" ");
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The moment drawn on the roof picture: night falling over it, each panel dimmed by how little sun reaches it and
 * edged in light when it is working, and the sun itself on its arc across the picture (the middle of the picture is
 * straight overhead, its edge the horizon, north up). Goes inside the picture's SVG, over the panels.
 */
export function DayOverlay(props: {
  day: HomeDay;
  step: DayStep;
  panels: readonly (readonly Px[])[];
  view: { x: number; y: number; w: number; h: number };
  u: number;
}) {
  const { day, step, view, u } = props;
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const reach = Math.min(view.w, view.h) * 0.46;
  const sky = (sun: SunPosition): Px => {
    const out = reach * (1 - clamp(sun.elevation, 0, 90) / 90);
    const a = (sun.azimuth * Math.PI) / 180;
    // Rounded, so the server and the browser draw the same thing to the last digit.
    return [r2(cx + Math.sin(a) * out), r2(cy - Math.cos(a) * out)];
  };
  const arc = day.steps.filter((s) => s.sun.elevation > 0).map((s) => sky(s.sun));
  const up = step.sun.elevation;
  const night = r2(clamp((6 - up) / 12) * 0.55);
  const [sx, sy] = sky(step.sun);
  return (
    <g pointerEvents="none">
      <rect
        x={view.x}
        y={view.y}
        width={view.w}
        height={view.h}
        fill="#060a16"
        opacity={night}
        style={{ transition: `opacity ${TICK_MS}ms linear` }}
      />
      {props.panels.map((corners, n) => {
        const glow = r2(step.glow[n] ?? 0);
        return (
          <g key={n}>
            <polygon
              points={join(corners)}
              fill="#04070d"
              opacity={r2((1 - glow) * 0.62)}
              style={{ transition: `opacity ${TICK_MS}ms linear` }}
            />
            <polygon
              points={join(corners)}
              fill="#ffd98a"
              fillOpacity={r2(glow * 0.2)}
              stroke="#ffe7b3"
              strokeOpacity={r2(glow * 0.95)}
              strokeWidth={0.7 * u}
              strokeLinejoin="round"
              style={{ transition: `fill-opacity ${TICK_MS}ms linear, stroke-opacity ${TICK_MS}ms linear` }}
            />
          </g>
        );
      })}
      {arc.length > 1 && (
        <polyline
          points={join(arc)}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.5}
          strokeWidth={0.9 * u}
          strokeDasharray={`${2 * u} ${3 * u}`}
        />
      )}
      {up > -2 && (
        <g
          style={{ transform: `translate(${sx}px, ${sy}px)`, transition: `transform ${TICK_MS}ms linear, opacity ${TICK_MS}ms linear` }}
          opacity={r2(clamp((up + 2) / 6))}
        >
          <circle r={26 * u} fill="#ffcf5c" opacity={0.14} />
          <circle r={16 * u} fill="#ffcf5c" opacity={0.28} />
          <circle r={9 * u} fill="#ffd978" stroke="#fff3d1" strokeWidth={1.2 * u} />
        </g>
      )}
    </g>
  );
}

const W = 480;
const H = 96;
const xAt = (hour: number) => (hour / 24) * W;

/** A curve through the day's steps as an SVG path, closed down to the foot when `fill`. */
function curve(steps: readonly DayStep[], of: (s: DayStep) => number, top: number, height: number, peak: number, fill: boolean): string {
  const y = (v: number) => top + height - (peak > 0 ? clamp(v / peak) : 0) * height;
  const line = steps.map((s, i) => `${i ? "L" : "M"}${xAt(s.hour).toFixed(1)},${y(of(s)).toFixed(1)}`).join(" ");
  return fill
    ? `${line} L${xAt(steps[steps.length - 1].hour).toFixed(1)},${top + height} L${xAt(steps[0].hour).toFixed(1)},${top + height} Z`
    : line;
}

/** The day as a chart to drag through: what the panels make over what the home uses, the battery's level under it, and where the grid is drawn on. */
function DayChart(props: { state: HomeDayState; day: HomeDay; step: DayStep; hasBattery: boolean; hasHome: boolean; flat?: boolean }) {
  const { state, day, step, hasBattery, hasHome, flat } = props;
  const chart = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const seek = (clientX: number) => {
    const box = chart.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    state.setPlaying(false);
    state.setAt(Math.floor(clamp((clientX - box.left) / box.width, 0, 0.9999) * DAY_STEPS));
  };
  const powerTop = 4;
  const powerH = 56;
  const batteryTop = 68;
  const batteryH = 14;
  const gridTop = 88;
  const half = W / DAY_STEPS / 2;
  return (
    <svg
      ref={chart}
      viewBox={`0 0 ${W} ${flat ? H : H + 12}`}
      preserveAspectRatio={flat ? "none" : undefined}
      className={clsx("block w-full cursor-ew-resize touch-none select-none", flat && "h-[4.5rem] rounded-lg")}
      role="slider"
      aria-label="The time of day"
      aria-valuemin={0}
      aria-valuemax={DAY_STEPS - 1}
      aria-valuenow={state.at}
      aria-valuetext={clockWords(step.hour)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        state.setPlaying(false);
        state.setAt((state.at + (e.key === "ArrowRight" ? 1 : DAY_STEPS - 1)) % DAY_STEPS);
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && seek(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* The hours the sun is down, shaded. */}
      {day.steps.map(
        (s) =>
          s.sun.elevation <= 0 && (
            <rect key={s.hour} x={xAt(s.hour) - half} y={0} width={half * 2 + 0.3} height={H} fill="#000000" opacity={0.22} />
          ),
      )}
      {/* What the home uses, and over it what the panels make. */}
      {hasHome && (
        <>
          <path d={curve(day.steps, (s) => s.use, powerTop, powerH, day.peakKw, true)} fill="currentColor" opacity={0.16} />
          <path
            d={curve(day.steps, (s) => s.use, powerTop, powerH, day.peakKw, false)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      <path d={curve(day.steps, (s) => s.solar, powerTop, powerH, day.peakKw, true)} fill="#ffcf5c" opacity={0.3} />
      <path
        d={curve(day.steps, (s) => s.solar, powerTop, powerH, day.peakKw, false)}
        fill="none"
        stroke="#ffcf5c"
        strokeWidth={flat ? 2 : 1.4}
        vectorEffect="non-scaling-stroke"
      />
      {/* The battery's level through the day. */}
      {hasBattery && (
        <>
          <rect x={0} y={batteryTop} width={W} height={batteryH} rx={3} fill="currentColor" opacity={0.08} />
          <path d={curve(day.steps, (s) => s.share, batteryTop, batteryH, 1, true)} fill="#5b8def" opacity={0.85} />
        </>
      )}
      {/* Where the grid is drawn on (red) and where the spare goes out to it (grey). */}
      {hasHome &&
        day.steps.map((s) =>
          s.imported > 0.05 || s.exported > 0.05 ? (
            <rect
              key={s.hour}
              x={xAt(s.hour) - half}
              y={gridTop}
              width={half * 2 + 0.3}
              height={4}
              fill={s.imported > 0.05 ? "#e2725b" : "currentColor"}
              opacity={s.imported > 0.05 ? 0.9 : 0.25}
            />
          ) : null,
        )}
      {!flat &&
        [6, 12, 18].map((hour) => (
          <text key={hour} x={xAt(hour)} y={H + 10} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>
            {hour === 12 ? "noon" : hour < 12 ? `${hour} am` : `${hour - 12} pm`}
          </text>
        ))}
      {/* The moment. */}
      <line
        x1={xAt(step.hour)}
        y1={0}
        x2={xAt(step.hour)}
        y2={H}
        stroke="var(--sun-line)"
        strokeWidth={flat ? 2 : 1.4}
        vectorEffect="non-scaling-stroke"
        style={{ transition: `all ${TICK_MS}ms linear` }}
      />
      {!flat && <circle cx={xAt(step.hour)} cy={0} r={3} fill="var(--sun-line)" style={{ transition: `all ${TICK_MS}ms linear` }} />}
    </svg>
  );
}

const DOT = "size-2 shrink-0 rounded-full";

/** What is happening at the moment, a line each: the panels, the home, the battery, the grid. */
function Moment(props: { step: DayStep; hasBattery: boolean; hasHome: boolean; className?: string }) {
  const moment = momentWords(props.step, props.hasBattery, props.hasHome);
  return (
    <div className={clsx("text-[12px] font-medium leading-tight", props.className)}>
      <p className="flex items-center gap-1.5">
        <i className={clsx(DOT, "bg-[#ffcf5c]")} aria-hidden />
        {moment.sun}
      </p>
      {moment.home && (
        <p className="flex items-center gap-1.5">
          <i className={clsx(DOT, "bg-current opacity-50")} aria-hidden />
          {moment.home}
        </p>
      )}
      {moment.battery && (
        <p className="flex items-center gap-1.5">
          <i className={clsx(DOT, "bg-[#5b8def]")} aria-hidden />
          {moment.battery}
        </p>
      )}
      {moment.grid && (
        <p className="flex items-center gap-1.5">
          <i className={clsx(DOT, props.step.imported > 0.05 ? "bg-[#e2725b]" : "bg-current opacity-25")} aria-hidden />
          {moment.grid}
        </p>
      )}
    </div>
  );
}

function Seasons(props: { state: HomeDayState }) {
  const { state } = props;
  return (
    <div className="flex items-center rounded-full border border-line p-0.5 text-[12px] font-medium" role="group" aria-label="The season">
      {DAY_SEASONS.map((s) => (
        <button
          key={s.id}
          onClick={() => state.setSeason(s.id)}
          aria-pressed={state.season === s.id}
          className={clsx(
            "h-7 flex-1 rounded-full px-2.5",
            state.season === s.id ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function PlayButton(props: { state: HomeDayState; className: string }) {
  const { state } = props;
  return (
    <button
      onClick={() => state.setPlaying(!state.playing)}
      aria-label={state.playing ? "Pause the day" : "Play the day"}
      title={state.playing ? "Pause" : "Play the day"}
      className={clsx("flex shrink-0 items-center justify-center rounded-full", props.className)}
    >
      {state.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 translate-x-px" aria-hidden />}
    </button>
  );
}

const HOUR_MARKS: readonly (readonly [number, string])[] = [
  [6, "6 am"],
  [12, "noon"],
  [18, "6 pm"],
];

/**
 * The day's controls. In the designer, a player's bar along the foot of the picture (Martin: the card sat over the
 * roof it was about, and over the buttons beside it): play, the clock and the season on the left, the day as one
 * long timeline to drag through, the moment on the right, and the day in a line under it; low, so the roof and the
 * sun above it stay in view. On a customer's proposal (`yours`), part of the page: the controls over the chart.
 */
export function HomeDayCard(props: {
  state: HomeDayState;
  hasBattery: boolean;
  hasHome: boolean;
  /** On a customer's proposal: worded for them, in the business's own colour, as part of the page and with no way to put it away. */
  yours?: boolean;
}) {
  const { state } = props;
  const { day, step } = state;
  if (!day || !step) return null;
  const seasonLabel = DAY_SEASONS.find((s) => s.id === state.season)?.label ?? "Summer";
  const words = dayWords(day, seasonLabel, props.hasBattery, props.yours).join(" ");
  if (props.yours)
    return (
      <div className="pointer-events-auto w-full text-ink" role="group" aria-label="A day with this system">
        <div className="flex flex-col gap-3">
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <PlayButton state={state} className="size-9 bg-primary text-primary-ink" />
              <p className="text-xl font-semibold tabular-nums leading-none">{clockWords(step.hour)}</p>
            </div>
            <Seasons state={state} />
            <Moment step={step} hasBattery={props.hasBattery} hasHome={props.hasHome} className="flex w-full flex-wrap gap-x-4 gap-y-1" />
          </div>
          <div className="min-w-0 flex-1">
            <DayChart state={state} day={day} step={step} hasBattery={props.hasBattery} hasHome={props.hasHome} />
            <p className="mt-1.5 text-[12px] leading-snug text-ink-2">
              {words} <span className="text-muted">{DAY_NOTE_YOURS}</span>
            </p>
          </div>
        </div>
      </div>
    );
  return (
    <div
      className="pointer-events-auto w-full rounded-2xl border border-line bg-surface/90 px-3 pb-2 pt-2.5 text-ink shadow-lift backdrop-blur-md"
      role="group"
      aria-label="The home's day"
    >
      <div className="flex items-stretch gap-3">
        <div className="flex w-[13rem] shrink-0 flex-col justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PlayButton state={state} className="size-10 bg-sun-line text-white" />
            <p className="text-[22px] font-semibold tabular-nums leading-none">{clockWords(step.hour)}</p>
          </div>
          <Seasons state={state} />
        </div>
        <div className="min-w-0 flex-1">
          <DayChart state={state} day={day} step={step} hasBattery={props.hasBattery} hasHome={props.hasHome} flat />
          <div className="relative mt-0.5 h-3.5 text-[10px] leading-none text-muted" aria-hidden>
            {HOUR_MARKS.map(([hour, label]) => (
              <span key={label} className="absolute -translate-x-1/2" style={{ left: `${(hour / 24) * 100}%` }}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <Moment
          step={step}
          hasBattery={props.hasBattery}
          hasHome={props.hasHome}
          className="hidden w-[12.5rem] shrink-0 space-y-1.5 self-center md:block"
        />
        <button
          onClick={state.close}
          aria-label="Put the day away"
          title="Put the day away"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-1.5 border-t border-line pt-1.5 text-[12px] leading-snug text-ink-2">
        {words} <span className="text-muted">{props.hasHome ? DAY_NOTE : DAY_NO_BILL}</span>
      </p>
    </div>
  );
}
