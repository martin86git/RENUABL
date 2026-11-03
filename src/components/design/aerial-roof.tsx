"use client";

import { useId } from "react";
import { PanelDefs, SolarPanel } from "./aerial-home";

/**
 * A made-up home from above, as a Marketplace listing shows a roof (3 Nov 2026, Martin: "more realistic rooftop
 * images"): the roof sharp, its faces lit and shaded by a northern sun, tiles or metal sheeting, ridges, hips and
 * gutters, the odd vent or skylight, and the panels laid on it as a designer lays them (from the gutter up, each row
 * no longer than the one below, clear of the edges); everything round it (lawn, trees, the drive, the street, the
 * houses next door) blurred and dimmed, as a real listing's picture is. Drawn rather than photographed, so no real
 * home is shown. 640 × 360.
 */

export type RoofForm = "hip" | "gable" | "ell" | "flat" | "skillion";
export type RoofFinish = "charcoal-tile" | "terracotta" | "monument" | "surfmist" | "woodland" | "shale" | "zinc";

export interface AerialRoofSpec {
  form: RoofForm;
  finish: RoofFinish;
  /** The house's footprint in the picture: left, top, width, height. */
  at: [number, number, number, number];
  /** Panels on each face (north is the top of the picture). */
  panels: { north?: number; west?: number; east?: number; wing?: number };
  /** Pixels a metre: smaller for a big commercial roof. */
  scale?: number;
  /** The wing of an L-shaped home: its left, width, and how far it reaches below the main roof. */
  wing?: [number, number, number];
  pool?: boolean;
  seed: number;
}

const FINISH: Record<RoofFinish, { base: string; groove: string; tile: boolean }> = {
  "charcoal-tile": { base: "#4b4f55", groove: "#2c2f33", tile: true },
  terracotta: { base: "#a35b40", groove: "#77402e", tile: true },
  monument: { base: "#3f4144", groove: "#2c2e30", tile: false },
  surfmist: { base: "#dedcd3", groove: "#bdbbb2", tile: false },
  woodland: { base: "#5d625b", groove: "#464a44", tile: false },
  shale: { base: "#b2b1a9", groove: "#93928b", tile: false },
  zinc: { base: "#c6c9cb", groove: "#a3a7aa", tile: false },
};

/** How much each face is shaded: the sun is to the north (the top), a little west. */
const SHADE = { north: 0, west: 0.12, east: 0.26, south: 0.36 };

type Pt = [number, number];
const poly = (pts: Pt[]) => pts.map((p) => p.join(",")).join(" ");

/** A little sequence of numbers from a seed, so each home's garden is its own but the same every time. */
function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

interface Face {
  pts: Pt[];
  shade: number;
  /** The way the courses or ribs run: across (a north or south face) or down (an east or west one). */
  across: boolean;
}

interface PackSpec {
  /** Which way the face runs from its gutter: into the picture (down), up, right or left. */
  axis: "down" | "up" | "right" | "left";
  gutter: number;
  depth: number;
  start: number;
  end: number;
  /** How much narrower each end gets per pixel up the slope (1 on a hip, 0 on a gable). */
  taperStart: number;
  taperEnd: number;
  count: number;
  /** The panel across the row, and down the slope. */
  across: number;
  along: number;
  /** Extra room between rows (tilt frames on a flat roof). */
  rowGap?: number;
  /** The most panels in a row: tilt-frame rows on a commercial roof are kept short enough to walk round. */
  rowMax?: number;
  clear: number;
}

/** Panels on a face, from the gutter up: each row as long as the face allows there, centred, no lone panel. */
function packFace(p: PackSpec): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const gap = 1.5;
  let left = p.count;
  for (let v = p.clear; left > 0 && v + p.along <= p.depth - p.clear; v += p.along + gap + (p.rowGap ?? 0)) {
    const top = v + p.along;
    const from = p.start + p.taperStart * top + p.clear;
    const to = p.end - p.taperEnd * top - p.clear;
    let n = Math.min(left, p.rowMax ?? Infinity, Math.floor((to - from + gap) / (p.across + gap)));
    if (n < 2) break;
    if (left - n === 1) n -= 1;
    const span = n * p.across + (n - 1) * gap;
    const u0 = (from + to) / 2 - span / 2;
    for (let i = 0; i < n; i++) {
      const u = u0 + i * (p.across + gap);
      if (p.axis === "down") out.push([u, p.gutter + v, p.across, p.along]);
      else if (p.axis === "up") out.push([u, p.gutter - v - p.along, p.across, p.along]);
      else if (p.axis === "right") out.push([p.gutter + v, u, p.along, p.across]);
      else out.push([p.gutter - v - p.along, u, p.along, p.across]);
    }
    left -= n;
  }
  return out;
}

/** A hip roof's faces and ridge lines over a rectangle; `long` says which way its ridge runs. */
function hip(x0: number, y0: number, w: number, h: number, vertical = false) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  if (!vertical) {
    const d = h / 2;
    const ym = y0 + d;
    const faces: Face[] = [
      {
        pts: [
          [x0, y0],
          [x1, y0],
          [x1 - d, ym],
          [x0 + d, ym],
        ],
        shade: SHADE.north,
        across: true,
      },
      {
        pts: [
          [x0, y1],
          [x1, y1],
          [x1 - d, ym],
          [x0 + d, ym],
        ],
        shade: SHADE.south,
        across: true,
      },
      {
        pts: [
          [x0, y0],
          [x0 + d, ym],
          [x0, y1],
        ],
        shade: SHADE.west,
        across: false,
      },
      {
        pts: [
          [x1, y0],
          [x1 - d, ym],
          [x1, y1],
        ],
        shade: SHADE.east,
        across: false,
      },
    ];
    const lines = `M${x0 + d} ${ym}H${x1 - d}M${x0} ${y0}L${x0 + d} ${ym}L${x0} ${y1}M${x1} ${y0}L${x1 - d} ${ym}L${x1} ${y1}`;
    return { faces, lines, ridge: d };
  }
  const d = w / 2;
  const xm = x0 + d;
  const faces: Face[] = [
    {
      pts: [
        [x0, y0],
        [xm, y0 + d],
        [xm, y1 - d],
        [x0, y1],
      ],
      shade: SHADE.west,
      across: false,
    },
    {
      pts: [
        [x1, y0],
        [xm, y0 + d],
        [xm, y1 - d],
        [x1, y1],
      ],
      shade: SHADE.east,
      across: false,
    },
    {
      pts: [
        [x0, y0],
        [x1, y0],
        [xm, y0 + d],
      ],
      shade: SHADE.north,
      across: true,
    },
    {
      pts: [
        [x0, y1],
        [x1, y1],
        [xm, y1 - d],
      ],
      shade: SHADE.south,
      across: true,
    },
  ];
  const lines = `M${xm} ${y0 + d}V${y1 - d}M${x0} ${y0}L${xm} ${y0 + d}L${x1} ${y0}M${x0} ${y1}L${xm} ${y1 - d}L${x1} ${y1}`;
  return { faces, lines, ridge: d };
}

export function AerialRoof({ spec, className }: { spec: AerialRoofSpec; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `ar${uid}-${s}`;
  const f = FINISH[spec.finish];
  const [x0, y0, w, h] = spec.at;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const m = spec.scale ?? 16;
  // A panel 1.13 × 1.72 m, a little shorter down a pitched roof from above; on a flat roof, tilted on frames.
  const across = 1.13 * m;
  const along = 1.72 * m * (spec.form === "flat" ? 0.82 : 0.93);
  const clear = 0.3 * m;
  const r = rand(spec.seed);

  let faces: Face[] = [];
  let lines = "";
  // The wing of an L-shaped home: its ridge and hips show only below the main roof.
  let wingOnly = "";
  let outline: Pt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  let panels: [number, number, number, number][] = [];
  const pk = (o: Omit<PackSpec, "across" | "along" | "clear">) => packFace({ ...o, across, along, clear });

  if (spec.form === "hip" || spec.form === "ell") {
    let wingFaces: Face[] = [];
    let wingLines = "";
    if (spec.form === "ell" && spec.wing) {
      const [wx, ww, reach] = spec.wing;
      const wy = y0 + h * 0.35;
      const wh = y1 - wy + reach;
      const wingRoof = hip(wx, wy, ww, wh, true);
      wingFaces = wingRoof.faces;
      wingLines = wingRoof.lines;
      outline = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [wx + ww, y1],
        [wx + ww, wy + wh],
        [wx, wy + wh],
        [wx, y1],
        [x0, y1],
      ];
      if (spec.panels.wing)
        panels.push(
          ...pk({
            axis: "right",
            gutter: wx,
            depth: ww / 2,
            start: y1 + 2,
            end: wy + wh,
            taperStart: 0,
            taperEnd: 1,
            count: spec.panels.wing,
          }),
        );
    }
    const main = hip(x0, y0, w, h);
    faces = [...wingFaces, ...main.faces];
    lines = main.lines;
    wingOnly = wingLines;
    if (spec.panels.north)
      panels.push(
        ...pk({ axis: "down", gutter: y0, depth: main.ridge, start: x0, end: x1, taperStart: 1, taperEnd: 1, count: spec.panels.north }),
      );
    if (spec.panels.west)
      panels.push(
        ...pk({ axis: "right", gutter: x0, depth: main.ridge, start: y0, end: y1, taperStart: 1, taperEnd: 1, count: spec.panels.west }),
      );
    if (spec.panels.east)
      panels.push(
        ...pk({ axis: "left", gutter: x1, depth: main.ridge, start: y0, end: y1, taperStart: 1, taperEnd: 1, count: spec.panels.east }),
      );
  } else if (spec.form === "gable") {
    const ym = y0 + h / 2;
    faces = [
      {
        pts: [
          [x0, y0],
          [x1, y0],
          [x1, ym],
          [x0, ym],
        ],
        shade: SHADE.north,
        across: true,
      },
      {
        pts: [
          [x0, ym],
          [x1, ym],
          [x1, y1],
          [x0, y1],
        ],
        shade: SHADE.south,
        across: true,
      },
    ];
    lines = `M${x0} ${ym}H${x1}`;
    if (spec.panels.north)
      panels = pk({ axis: "down", gutter: y0, depth: h / 2, start: x0, end: x1, taperStart: 0, taperEnd: 0, count: spec.panels.north });
  } else {
    // Flat or skillion: one plane, ribs running down it.
    faces = [{ pts: outline, shade: spec.form === "skillion" ? 0.06 : 0.02, across: false }];
    const flat = spec.form === "flat";
    if (spec.panels.north)
      panels = packFace({
        axis: "down",
        gutter: y0,
        depth: h,
        start: x0,
        end: x1,
        taperStart: 0,
        taperEnd: 0,
        count: spec.panels.north,
        across,
        along,
        clear: flat ? 1.2 * m : clear,
        rowGap: flat ? 0.9 * m : 0,
        rowMax: flat ? 16 : undefined,
      });
  }

  // The garden, laid out from the seed: trees, a drive to the street, the homes next door.
  const trees = Array.from({ length: 7 }, () => {
    const side = r() < 0.5;
    return {
      x: side ? r() * (x0 - 10) : x1 + 10 + r() * (640 - x1 - 10),
      y: 10 + r() * 300,
      r: 14 + r() * 26,
    };
  });
  const driveX = r() < 0.5 ? x0 + 10 : x1 - 70;
  const street = 322;

  return (
    <svg viewBox="0 0 640 360" className={className} role="img" aria-label="A roof design from above, everything round it blurred">
      <PanelDefs />
      <defs>
        <filter id={id("grass")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={spec.seed} result="fine" />
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed={spec.seed + 4} result="patch" />
          <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.36  0 0 0 0 0.18  0 0 0 0.5 0" result="fc" />
          <feColorMatrix in="patch" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.5  0 0 0 0 0.3  0 0 0 1.6 -0.55" result="pc" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="pc" />
            <feMergeNode in="fc" />
          </feMerge>
        </filter>
        <filter id={id("leaves")} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves="3" seed={spec.seed + 9} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id("blur")} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={id("soft")} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id={id("weather")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed={spec.seed + 2} result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0.9 -0.4" result="w" />
          <feComposite in="w" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed={spec.seed + 7} result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g" result="s">
            <feFuncA type="linear" slope="0.16" />
          </feComponentTransfer>
          <feComposite in="s" in2="SourceGraphic" operator="in" result="sp" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="sp" />
          </feMerge>
        </filter>
        {/* Tiles in courses, or metal ribs, each two ways: across a north or south face, or down an east or west one. */}
        {[false, true].map((turned) => (
          <pattern
            key={String(turned)}
            id={id(turned ? "skin-t" : "skin")}
            width={f.tile ? 8 : 5}
            height={f.tile ? 5 : 10}
            patternUnits="userSpaceOnUse"
            patternTransform={turned ? "rotate(90)" : undefined}
          >
            {f.tile ? (
              <>
                <rect width="8" height="5" fill={f.base} />
                <rect width="8" height="1.1" y="3.9" fill={f.groove} />
                <rect x="3.8" width="0.5" height="3.9" fill={f.groove} opacity="0.6" />
              </>
            ) : (
              <>
                <rect width="5" height="10" fill={f.base} />
                <rect width="0.9" height="10" fill={f.groove} />
                <rect x="0.9" width="0.5" height="10" fill="#fff" opacity="0.12" />
              </>
            )}
          </pattern>
        ))}
        <linearGradient id={id("light")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <clipPath id={id("below")}>
          <rect x="0" y={y1} width="640" height={360 - y1} />
        </clipPath>
        <clipPath id={id("roof")}>
          <polygon points={poly(outline)} />
        </clipPath>
      </defs>

      {/* Round the roof: blurred and dimmed. */}
      <g filter={`url(#${id("blur")})`}>
        <rect width="640" height="360" fill="#5d6e4e" filter={`url(#${id("grass")})`} />
        {/* The homes next door, at the edges. */}
        <rect x="-40" y="40" width="110" height="170" fill={r() < 0.5 ? "#8e4f3b" : "#6a6e72"} />
        <rect x="586" y="70" width="110" height="160" fill={r() < 0.5 ? "#55595d" : "#b9b7ae"} />
        <path d={`M0 ${street - 10}H640`} stroke="#d9d4c7" strokeWidth="6" />
        <rect x="0" y={street} width="640" height="40" fill="#5b5d5f" filter={`url(#${id("grain")})`} />
        <rect x={driveX} y={y1} width="60" height={street - y1} fill="#c4bfb3" filter={`url(#${id("grain")})`} />
        {spec.pool && <rect x={x1 - 110} y={Math.max(14, y0 - 70)} width="78" height="40" rx="8" fill="#5bbccb" />}
        <path d="M0 6H640M8 0V330M632 0V330" stroke="#a89c86" strokeWidth="2.5" opacity="0.6" />
        {/* The house's shadow, then the trees and theirs. */}
        <polygon points={poly(outline.map(([x, y]) => [x + 8, y + 10] as Pt))} fill="#141612" opacity="0.55" />
        {trees.map((t, i) => (
          <g key={i} filter={`url(#${id("leaves")})`}>
            <circle cx={t.x + 6} cy={t.y + 8} r={t.r} fill="#1b2416" opacity="0.6" />
            <circle cx={t.x} cy={t.y} r={t.r} fill={i % 2 ? "#3f6634" : "#4c7440"} />
            <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.3} r={t.r * 0.55} fill="#6b9455" opacity="0.6" />
          </g>
        ))}
      </g>
      <rect width="640" height="360" fill="#0b0b0c" fillOpacity="0.32" />

      {/* The roof, sharp. */}
      <g clipPath={`url(#${id("roof")})`}>
        {faces.map((fc, i) => (
          <g key={i}>
            <polygon points={poly(fc.pts)} fill={`url(#${id(fc.across ? "skin" : "skin-t")})`} />
            <polygon points={poly(fc.pts)} fill={fc.shade > 0 ? "#000" : "#fff"} fillOpacity={fc.shade > 0 ? fc.shade : 0.07} />
          </g>
        ))}
        <rect x={x0} y={y0} width={w} height={h + 200} filter={`url(#${id("weather")})`} fill="#000" opacity={f.tile ? 0.6 : 0.3} />
        <rect x={x0} y={y0} width={w} height={h + 200} fill={`url(#${id("light")})`} />
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h + 200}
          fill="#808080"
          opacity="0.5"
          filter={`url(#${id("grain")})`}
          style={{ mixBlendMode: "overlay" }}
        />
        {/* Ridge and hip capping, lighter than the roof. */}
        <path d={lines} stroke="#fff" strokeOpacity={f.tile ? 0.28 : 0.4} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d={lines} stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" fill="none" transform="translate(1.2 1.2)" />
        {wingOnly && (
          <path
            d={wingOnly}
            clipPath={`url(#${id("below")})`}
            stroke="#fff"
            strokeOpacity={f.tile ? 0.28 : 0.4}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* A vent and a skylight, the things a real roof has. */}
        <circle cx={x0 + w * 0.3} cy={y1 - h * 0.18} r="3.2" fill="#cfd2d4" stroke="#6d7173" strokeWidth="0.8" />
        {spec.form !== "flat" && (
          <rect x={x0 + w * 0.62} y={y1 - h * 0.3} width="12" height="9" fill="#9fb4c4" stroke="#e7ecef" strokeWidth="0.8" />
        )}
      </g>
      {/* Gutters. */}
      <polygon points={poly(outline)} fill="none" stroke="#e9e6df" strokeOpacity="0.75" strokeWidth="1.4" />

      {panels.map(([x, y, pw, ph], i) => (
        <g key={i}>
          <rect x={x + 1.5} y={y + 2} width={pw} height={ph} fill="#000" opacity="0.35" />
          <SolarPanel x={x} y={y} w={pw} h={ph} />
        </g>
      ))}
    </svg>
  );
}
