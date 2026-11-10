"use client";

/**
 * The designer's Drawn view (10 Nov 2026, Martin): the roof as an illustration in place of the photo. The faces the
 * design holds are drawn as planes in the roof's own colour (read from the photo already on the page), lit by the way
 * they look, with tile courses and a gutter; the surroundings are the same photo, small, grey and dim; panels are
 * drawn as panels; and the inverter, battery, switchboard and EV charger stand on a wall of their own. Everything is
 * made in the browser from what is already loaded: nothing is asked of a server. Rules in domain/design/illustrated-roof.ts.
 */
import { useEffect, useMemo, useState } from "react";
import {
  WALL,
  cellLines,
  colourInside,
  faceColour,
  ghosted,
  gutterOf,
  wallLayout,
  type Pixels,
  type Rgb,
  type WallKit,
} from "@/lib/domain/design/illustrated-roof";

type Px = readonly [number, number];

/** A face to draw: its outline on the picture, the way it looks and its pitch. */
export interface ArtFace {
  id: string;
  points: Px[];
  azimuth: number;
  pitch: number;
}

/** The photo is read at a quarter of the picture's size: plenty for a colour, soft when drawn large, and done in a blink. */
const SMALL = 1 / 4;

interface Ghost {
  from: string;
  url: string;
  pixels: Pixels;
}

/**
 * The photo's surroundings (small, grey, dim) and its pixels to read roof colours from, made once from the photo
 * already on the page. Null until made, or when the photo can't be read here.
 */
export function useRoofGhost(photo: string | undefined, on: boolean, width: number, height: number): Ghost | null {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  useEffect(() => {
    if (!on || !photo) return;
    let gone = false;
    const img = new window.Image();
    img.onload = () => {
      if (gone) return;
      try {
        const w = Math.round(width * SMALL);
        const h = Math.round(height * SMALL);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const pixels: Pixels = { data: new Uint8ClampedArray(data.data), width: w, height: h };
        ghosted(data.data);
        ctx.putImageData(data, 0, 0);
        // Drawn up to the picture's own size, smoothly, so it is soft rather than blocky when the view is close in.
        const soft = document.createElement("canvas");
        soft.width = width;
        soft.height = height;
        const softCtx = soft.getContext("2d");
        if (softCtx) {
          softCtx.imageSmoothingEnabled = true;
          softCtx.imageSmoothingQuality = "high";
          softCtx.drawImage(canvas, 0, 0, width, height);
        }
        setGhost({ from: photo, url: (softCtx ? soft : canvas).toDataURL("image/jpeg", 0.8), pixels });
      } catch {
        // The photo can't be read here: the roof is drawn in a plain grey on a plain ground.
      }
    };
    img.src = photo;
    return () => {
      gone = true;
    };
  }, [on, photo, width, height]);
  return ghost && ghost.from === photo ? ghost : null;
}

/** The moving parts' styles: a panel settling as it lands, power flowing along a line. Still with reduced motion. */
export function ArtStyles() {
  return (
    <style>{`
      @keyframes roof-settle { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: none; } }
      .roof-settle { transform-box: fill-box; transform-origin: center; animation: roof-settle 0.18s ease-out; }
      @keyframes roof-flow { to { stroke-dashoffset: 0; } }
      .roof-flow { animation: roof-flow 1.1s linear infinite; }
      @media (prefers-reduced-motion: reduce) { .roof-settle, .roof-flow { animation: none; } }
    `}</style>
  );
}

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
const join = (points: readonly Px[]) => points.map((p) => p.join(",")).join(" ");

/**
 * The roof drawn, with its surroundings: goes first inside the picture's SVG, in place of the photo.
 * `u` is one picture unit at the zoom in view (so lines stay fine), `perMetre` the picture units in a metre.
 */
export function RoofArt(props: { faces: ArtFace[]; ghost: Ghost | null; width: number; height: number; u: number; perMetre: number }) {
  const { faces, ghost, u } = props;
  // Each face's colour from the photo, and the whole roof's: worked out again only when a face or the photo changes.
  const colours = useMemo(() => {
    const own = faces.map((f) =>
      ghost
        ? colourInside(
            ghost.pixels,
            f.points.map(([x, y]) => [x * SMALL, y * SMALL] as const),
          )
        : null,
    );
    const read = own.filter((c): c is Rgb => c !== null);
    const roof: Rgb | null = read.length ? ([0, 1, 2].map((i) => read.reduce((sum, c) => sum + c[i], 0) / read.length) as Rgb) : null;
    return faces.map((f, i) => faceColour(own[i], roof, f.azimuth, f.pitch));
  }, [faces, ghost]);
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="roof-panel-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2c44" />
          <stop offset="0.55" stopColor="#0f1826" />
          <stop offset="1" stopColor="#0a1019" />
        </linearGradient>
        {faces.map((f) => {
          // Tile courses (or a metal roof's laps) across the slope, closer together as seen from above on a steeper roof.
          const course = Math.max(0.9, 0.34 * props.perMetre * Math.cos((Math.min(f.pitch, 60) * Math.PI) / 180));
          return (
            <pattern
              key={f.id}
              id={`roof-course-${safe(f.id)}`}
              patternUnits="userSpaceOnUse"
              width={12}
              height={course}
              patternTransform={`rotate(${f.azimuth})`}
            >
              <line x1={0} y1={course / 2} x2={12} y2={course / 2} stroke="#000000" strokeOpacity={0.14} strokeWidth={course * 0.16} />
            </pattern>
          );
        })}
      </defs>
      <ArtStyles />
      <rect width={props.width} height={props.height} fill="#20252d" />
      {ghost && <image href={ghost.url} width={props.width} height={props.height} preserveAspectRatio="none" />}
      {/* The roof's shadow on the ground, twice and softly, so it stands off its surroundings. */}
      {[2, 1].map((n) => (
        <g key={n} transform={`translate(${1.3 * n} ${1.8 * n})`} opacity={0.2}>
          {faces.map((f) => (
            <polygon key={f.id} points={join(f.points)} fill="#000000" stroke="#000000" strokeWidth={1.2} strokeLinejoin="round" />
          ))}
        </g>
      ))}
      {faces.map((f, i) => (
        <g key={f.id}>
          <polygon points={join(f.points)} fill={colours[i]} />
          <polygon points={join(f.points)} fill={`url(#roof-course-${safe(f.id)})`} />
        </g>
      ))}
      {/* Ridges, hips and edges as fine light lines; each face's gutter a darker one along its low edge. */}
      {faces.map((f) => {
        const gutter = gutterOf(f.points, f.azimuth, f.pitch);
        return (
          <g key={f.id}>
            <polygon
              points={join(f.points)}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.6}
              strokeWidth={0.8 * u}
              strokeLinejoin="round"
            />
            {gutter && (
              <line
                x1={gutter[0][0]}
                y1={gutter[0][1]}
                x2={gutter[1][0]}
                y2={gutter[1][1]}
                stroke="#14181e"
                strokeOpacity={0.6}
                strokeWidth={1.9 * u}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * A panel drawn as a panel: its shadow on the roof, dark glass in a silver frame, and its cells. On a string it takes
 * the string's colour (`fill`); picked, its frame is the edge colour given.
 */
export function PanelArt(props: { corners: readonly Px[]; u: number; edge?: string; edgeWidth?: number; fill?: string; cells: boolean }) {
  const { corners, u } = props;
  const points = join(corners);
  return (
    <g className="roof-settle">
      <polygon points={points} fill="#000000" opacity={0.38} transform={`translate(${0.7 * u} ${1 * u})`} />
      <polygon
        points={points}
        fill={props.fill ?? "url(#roof-panel-glass)"}
        fillOpacity={props.fill ? 0.82 : 1}
        stroke={props.edge ?? "#d3dae3"}
        strokeWidth={(props.edgeWidth ?? 0.55) * u}
        strokeLinejoin="round"
      />
      {props.cells &&
        cellLines(corners).map(([a, b], i) => (
          <line
            key={i}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke="#c4d6f2"
            strokeOpacity={i === 0 ? 0.3 : 0.17}
            strokeWidth={0.28 * u}
          />
        ))}
    </g>
  );
}

/** Power flowing along a line: moving dashes in the signal colour, over whatever line is already drawn there. */
export function FlowLine(props: { points: string; u: number }) {
  const dash = 3 * props.u;
  const gap = 5 * props.u;
  return (
    <polyline
      className="roof-flow"
      points={props.points}
      fill="none"
      stroke="var(--sun-line)"
      strokeWidth={1.1 * props.u}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${dash} ${gap}`}
      strokeDashoffset={dash + gap}
      pointerEvents="none"
    />
  );
}

/**
 * The wall: the inverter, the battery as a stack of its modules, the switchboard and the EV charger standing where
 * they really go, with the roof's cable coming down to them and power flowing through. Shown over the picture's
 * corner; it takes no presses.
 */
export function WallStrip(props: { kit: WallKit; panels: number }) {
  const { items, width } = useMemo(() => wallLayout(props.kit), [props.kit]);
  if (!items.length) return null;
  const wire = WALL.floor - 9;
  const flowing = props.panels > 0;
  const roofX = WALL.pad;
  // The cable's way: down from the roof, then along the wall through each thing on it.
  const run = [`${roofX + 9},24`, `${roofX + 9},${wire}`, ...items.map((i) => `${i.x + i.w / 2},${wire}`)].join(" ");
  return (
    <div
      className="pointer-events-none rounded-2xl border border-line bg-surface/75 px-2 pb-1 pt-1.5 text-ink shadow-lift backdrop-blur-md"
      role="img"
      aria-label={`On the wall: ${items.map((i) => (i.kind === "switchboard" ? "main switchboard" : `${i.kind} ${i.label}`)).join(", ")}`}
    >
      <svg
        viewBox={`0 0 ${width} ${WALL.height}`}
        style={{ height: "6.25rem", width: `${(width / WALL.height) * 6.25}rem` }}
        className="block"
      >
        <ArtStyles />
        <text x={WALL.pad - 8} y={9} fontSize={6} fontWeight={600} letterSpacing={0.6} fill="currentColor" opacity={0.55}>
          ON THE WALL
        </text>
        {/* The wall and the ground it stands on. */}
        <rect x={0} y={30} width={width} height={WALL.floor - 30} fill="currentColor" opacity={0.06} />
        <line x1={0} y1={WALL.floor} x2={width} y2={WALL.floor} stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.8} />
        {/* The roof's edge above it, a panel on its slope. */}
        <path d={`M${roofX - 8} 30 L${roofX + 22} 14`} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
        <path d={`M${roofX + 1} 22.5 L${roofX + 17} 14`} stroke="#0f1826" strokeWidth={4.2} strokeLinecap="round" />
        <path
          d={`M${roofX + 1} 22.5 L${roofX + 17} 14`}
          stroke="#d3dae3"
          strokeWidth={0.6}
          strokeLinecap="round"
          transform="translate(-1 -1.9)"
        />
        <polyline points={run} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={0.9} strokeLinejoin="round" />
        {flowing && <FlowLine points={run} u={0.9} />}
        {items.map((item, n) => (
          <g key={n}>
            <rect
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx={2.2}
              fill="#eef1f5"
              stroke="#0e1319"
              strokeOpacity={0.5}
              strokeWidth={0.6}
            />
            {item.kind === "inverter" && (
              <>
                <rect x={item.x + 4} y={item.y + 5} width={item.w - 8} height={7} rx={1} fill="#141a22" />
                <circle cx={item.x + item.w / 2} cy={item.y + item.h - 7} r={1.5} fill={flowing ? "var(--sun-line)" : "#9aa3af"} />
              </>
            )}
            {item.kind === "battery" &&
              Array.from({ length: item.modules ?? 1 }, (_, m) => {
                // Stacked from the floor up; a module held back for blackouts is the top one, in blue.
                const held = m >= (item.modules ?? 1) - (item.held ?? 0);
                return (
                  <rect
                    key={m}
                    className="roof-settle"
                    x={item.x + 2.5}
                    y={item.y + item.h - 4 - (m + 1) * 6 + 1}
                    width={item.w - 5}
                    height={4.6}
                    rx={1}
                    fill={held ? "#5b8def" : "var(--sun-line)"}
                    opacity={held ? 0.9 : 0.55 + (0.4 * (m + 1)) / (item.modules ?? 1)}
                  />
                );
              })}
            {item.kind === "switchboard" &&
              [0, 1].map((row) =>
                [0, 1, 2].map((col) => (
                  <rect
                    key={`${row}${col}`}
                    x={item.x + 3 + col * 4.4}
                    y={item.y + 5 + row * 8}
                    width={3}
                    height={5}
                    rx={0.6}
                    fill="#141a22"
                    opacity={0.75}
                  />
                )),
              )}
            {item.kind === "charger" && (
              <>
                <circle cx={item.x + item.w / 2} cy={item.y + 7} r={3} fill="#141a22" />
                <path
                  d={`M${item.x + item.w / 2} ${item.y + item.h - 5} q-9 7 -11 ${WALL.floor - item.y - item.h + 2}`}
                  fill="none"
                  stroke="#141a22"
                  strokeOpacity={0.8}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              </>
            )}
            <text x={item.x + item.w / 2} y={WALL.floor + 10} textAnchor="middle" fontSize={6.6} fontWeight={600} fill="currentColor">
              {item.label}
            </text>
            {item.kind === "battery" && (item.held ?? 0) > 0 && (
              <text x={item.x + item.w / 2} y={WALL.floor + 18} textAnchor="middle" fontSize={5.4} fill="#7da5f5">
                backup held
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
