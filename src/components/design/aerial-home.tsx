/**
 * A made-up home seen from above, drawn to read like an aerial photograph
 * for the front page's demos: a gabled roof of charcoal concrete tiles with
 * its ridge, hips and gutters, a flat garage roof of ribbed metal, a lawn,
 * trees and the shadows the afternoon sun throws, a concrete drive, a pool,
 * fences, the street and the edges of the roofs next door, with a little
 * grain over everything. Drawn rather than photographed, so no real home is
 * shown. Sized to the designer's picture: 640 × 400.
 *
 * The main roof is a hip roof 120–440 across and 60–260 down, its ridge
 * from 220 to 340 at 160 down: a north face (the top), a south face, and a
 * hip at each end. The garage roof is flat, 455–610 across and 180–280 down.
 */

/** Shadows fall down and to the right (south-east of a northern sun, in the picture's terms). */
const SHADOW = { dx: 7, dy: 9 };

export function AerialScene() {
  return (
    <g>
      <defs>
        {/* Grass: green, mottled, with mowing stripes. */}
        <filter id="aer-grass" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="fine" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" result="patch" />
          <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.38  0 0 0 0 0.2  0 0 0 0.55 0" result="fineC" />
          <feColorMatrix in="patch" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.5  0 0 0 0 0.27  0 0 0 1.6 -0.55" result="patchC" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="patchC" />
            <feMergeNode in="fineC" />
          </feMerge>
        </filter>
        {/* Concrete and asphalt: a fine speckle. */}
        <filter id="aer-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="5" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g" result="soft">
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feComposite in="soft" in2="SourceGraphic" operator="in" result="speck" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="speck" />
          </feMerge>
        </filter>
        {/* Foliage: clumped leaves, lit from the top left. */}
        <filter id="aer-leaves" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="2" result="m" />
          <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 0.7 -0.1" result="mc" />
          <feComposite in="mc" in2="d" operator="in" result="dots" />
          <feMerge>
            <feMergeNode in="d" />
            <feMergeNode in="dots" />
          </feMerge>
        </filter>
        <filter id="aer-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        {/* The whole picture's grain, as a photograph has. */}
        <filter id="aer-film" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="21" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g">
            <feFuncA type="linear" slope="0.07" />
          </feComponentTransfer>
        </filter>
        {/* Concrete roof tiles: rows of overlapping tiles, each course a little shadowed at its lower edge. */}
        <pattern id="aer-tiles" width="9" height="6" patternUnits="userSpaceOnUse">
          <rect width="9" height="6" fill="#3d4146" />
          <rect width="9" height="1.2" y="4.8" fill="#2a2d31" />
          <rect x="4.2" width="0.6" height="4.8" fill="#34383c" />
        </pattern>
        <pattern id="aer-tiles-lit" width="9" height="6" patternUnits="userSpaceOnUse">
          <rect width="9" height="6" fill="#6b7177" />
          <rect width="9" height="1.2" y="4.8" fill="#4f545a" />
          <rect x="4.2" width="0.6" height="4.8" fill="#5d6268" />
        </pattern>
        {/* Ribbed metal sheeting on the garage. */}
        <pattern id="aer-tiles-side" width="9" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          <rect width="9" height="6" fill="#474b50" />
          <rect width="9" height="1.2" y="4.8" fill="#33363a" />
          <rect x="4.2" width="0.6" height="4.8" fill="#3e4246" />
        </pattern>
        <pattern id="aer-tiles-side-lit" width="9" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          <rect width="9" height="6" fill="#50555a" />
          <rect width="9" height="1.2" y="4.8" fill="#3c4044" />
          <rect x="4.2" width="0.6" height="4.8" fill="#464a4f" />
        </pattern>
        <filter id="aer-weather" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="14" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.11  0 0 0 0 0.1  0 0 0 0.9 -0.35" result="w" />
          <feComposite in="w" in2="SourceGraphic" operator="in" />
        </filter>
        <pattern id="aer-ribs" width="6" height="10" patternUnits="userSpaceOnUse">
          <rect width="6" height="10" fill="#b9bdbf" />
          <rect width="1.1" height="10" fill="#9fa4a7" />
          <rect x="1.1" width="0.6" height="10" fill="#cfd2d3" />
        </pattern>
        <pattern id="aer-terracotta" width="8" height="5" patternUnits="userSpaceOnUse">
          <rect width="8" height="5" fill="#9b5a43" />
          <rect width="8" height="1" y="4" fill="#7c4433" />
        </pattern>
        <pattern id="aer-pavers" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#c9c1b3" />
          <path d="M0 0H10M0 5H10M5 0V5M0 5V10" stroke="#b3ab9d" strokeWidth="0.6" />
        </pattern>
        <linearGradient id="aer-pool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd3dc" />
          <stop offset="1" stopColor="#3aa3b8" />
        </linearGradient>
        <radialGradient id="aer-crown" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#5f8a4a" />
          <stop offset="0.6" stopColor="#3f6634" />
          <stop offset="1" stopColor="#2a4a25" />
        </radialGradient>
        <radialGradient id="aer-crown-dark" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4d7540" />
          <stop offset="1" stopColor="#223d1f" />
        </radialGradient>
      </defs>

      {/* The ground: lawn everywhere, the street and footpath along the bottom. */}
      <rect width="640" height="400" fill="#4d6b3f" filter="url(#aer-grass)" />
      <rect y="352" width="640" height="48" fill="#5a5d60" filter="url(#aer-grain)" />
      <rect y="338" width="640" height="14" fill="#bdb8ad" filter="url(#aer-grain)" />
      <rect y="350" width="640" height="2.5" fill="#d8d4cb" />
      <path d="M0 380 H640" stroke="#e6e2c9" strokeWidth="1.4" strokeDasharray="18 14" opacity="0.7" />
      {/* Garden beds of mulch along the fences, and a hedge down the side. */}
      <rect x="120" y="32" width="506" height="8" fill="#5e4a36" filter="url(#aer-grain)" opacity="0.9" />
      <rect x="120" y="300" width="60" height="30" rx="6" fill="#5e4a36" filter="url(#aer-grain)" opacity="0.9" />
      <rect x="610" y="36" width="14" height="130" rx="7" fill="url(#aer-crown-dark)" filter="url(#aer-leaves)" />
      {/* Fences on the boundaries. */}
      <path d="M118 0 V338 M628 0 V338 M118 30 H628" stroke="#a89e8a" strokeWidth="1.6" fill="none" opacity="0.85" />

      {/* Next door: a terracotta hip roof on the left, a pale metal one on the right, both cut off by the edge of the picture. */}
      <g>
        <rect
          x="-40"
          y="120"
          width="140"
          height="150"
          fill="#000"
          opacity="0.28"
          filter="url(#aer-blur)"
          transform={`translate(${SHADOW.dx} ${SHADOW.dy})`}
        />
        <polygon points="-40,120 100,120 60,195 -40,195" fill="url(#aer-terracotta)" />
        <polygon points="-40,270 100,270 60,195 -40,195" fill="url(#aer-terracotta)" opacity="0.82" />
        <polygon points="100,120 100,270 60,195" fill="#874d3a" />
        <path d="M-40 195 H60 L100 120 M60 195 L100 270" stroke="#c07a5e" strokeWidth="1" fill="none" />
      </g>
      <g>
        <rect x="636" y="40" width="40" height="190" fill="#000" opacity="0.25" filter="url(#aer-blur)" />
        <rect x="633" y="40" width="20" height="190" fill="url(#aer-ribs)" />
      </g>

      {/* The drive and the paths, in concrete; the paved patio and the pool out the back. */}
      <rect x="500" y="280" width="84" height="60" fill="#c4c0b6" filter="url(#aer-grain)" />
      <rect x="196" y="262" width="18" height="76" fill="#c4c0b6" filter="url(#aer-grain)" />
      <rect x="150" y="34" width="150" height="26" fill="url(#aer-pavers)" />
      <rect x="470" y="64" width="96" height="40" rx="5" fill="#e9eef0" />
      <rect x="474" y="68" width="88" height="32" rx="3" fill="url(#aer-pool)" />
      <path d="M480 80 q8 -4 16 0 t16 0 t16 0 t16 0 t14 0" stroke="#bff0f4" strokeWidth="0.8" fill="none" opacity="0.7" />
      {/* A clothesline and a garden bed. */}
      <g stroke="#d9d6cf" strokeWidth="0.7" opacity="0.8">
        <path d="M330 20 l22 22 M352 20 l-22 22" />
      </g>
      <rect x="456" y="120" width="70" height="10" rx="4" fill="#5b4a37" opacity="0.85" />

      {/* The roofs' shadows on the ground. */}
      <polygon
        points="120,60 440,60 440,260 120,260"
        fill="#000"
        opacity="0.4"
        filter="url(#aer-blur)"
        transform={`translate(${SHADOW.dx} ${SHADOW.dy})`}
      />
      <rect x="455" y="180" width="155" height="100" fill="#000" opacity="0.3" filter="url(#aer-blur)" transform="translate(4 6)" />
      {/* A covered walkway between the house and the garage. */}
      <rect x="440" y="196" width="15" height="40" fill="#a9adb0" />

      {/* The garage: flat ribbed metal with its gutter. */}
      <rect x="455" y="180" width="155" height="100" fill="url(#aer-ribs)" />
      <rect x="455" y="180" width="155" height="100" fill="none" stroke="#868b8e" strokeWidth="1.4" />
      <rect x="455" y="276" width="155" height="4" fill="#8f9497" />
      <circle cx="596" cy="192" r="3" fill="#7d8285" stroke="#e1e3e4" strokeWidth="0.8" />

      {/* The house: a hipped roof in charcoal concrete tiles. The north face (top) takes the sun, the south is in shade,
          and on the hips the courses of tiles run the other way. */}
      <polygon points="120,60 440,60 340,160 220,160" fill="url(#aer-tiles-lit)" />
      <polygon points="120,260 440,260 340,160 220,160" fill="url(#aer-tiles)" />
      <polygon points="120,60 220,160 120,260" fill="url(#aer-tiles-side)" />
      <polygon points="440,60 340,160 440,260" fill="url(#aer-tiles-side-lit)" />
      {/* Weathering: tiles are never one even colour. */}
      <polygon points="120,60 440,60 440,260 120,260" fill="#000" filter="url(#aer-weather)" opacity="0.5" />
      {/* The ridge and the hips, capped in mortar-bedded ridge tiles. */}
      <path
        d="M120 60 L220 160 L340 160 L440 60 M120 260 L220 160 M340 160 L440 260"
        stroke="#7c8187"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M120 60 L220 160 L340 160 L440 60 M120 260 L220 160 M340 160 L440 260"
        stroke="#4b4f54"
        strokeWidth="0.7"
        strokeDasharray="4 3"
        fill="none"
      />
      {/* Gutters all round, and the eaves' edge catching the light. */}
      <rect x="118" y="58" width="324" height="204" fill="none" stroke="#26292c" strokeWidth="2.6" />
      <rect x="116.5" y="56.5" width="327" height="207" fill="none" stroke="#dcdad4" strokeWidth="0.9" opacity="0.6" />
      {/* A skylight and vent pipes on the shaded faces, clear of the panels. */}
      <rect x="260" y="200" width="16" height="22" rx="1.5" fill="#a9c2cf" stroke="#e2e8eb" strokeWidth="1" />
      <circle cx="380" cy="222" r="2.4" fill="#9aa0a5" stroke="#d2d5d8" strokeWidth="0.6" />
      <circle cx="170" cy="232" r="2.4" fill="#9aa0a5" stroke="#d2d5d8" strokeWidth="0.6" />
      {/* An air-conditioning unit on the garage roof. */}
      <rect x="578" y="250" width="22" height="16" rx="1.5" fill="#d6d8d9" stroke="#9a9fa2" strokeWidth="0.8" />
      <circle cx="589" cy="258" r="5" fill="none" stroke="#8b9093" strokeWidth="0.8" />

      {/* Trees, each with its shadow thrown across what is beside it. */}
      {TREES.map((t, i) => (
        <g key={i}>
          <circle cx={t.x + SHADOW.dx * 1.6} cy={t.y + SHADOW.dy * 1.6} r={t.r} fill="#000" opacity="0.33" filter="url(#aer-blur)" />
          <circle cx={t.x} cy={t.y} r={t.r} fill={i % 2 ? "url(#aer-crown-dark)" : "url(#aer-crown)"} filter="url(#aer-leaves)" />
        </g>
      ))}

      {/* The street tree's canopy reaching over the footpath, and a car on the drive. */}
      <g transform="translate(512 306)">
        <rect x="4" y="4" width="26" height="16" rx="5" fill="#000" opacity="0.3" filter="url(#aer-blur)" />
        <rect width="26" height="15" rx="5" fill="#e9ecee" />
        <rect x="7" y="2" width="12" height="11" rx="2.5" fill="#4b5560" />
      </g>

      {/* Film grain over the whole picture. */}
      <rect width="640" height="400" filter="url(#aer-film)" opacity="0.9" />
    </g>
  );
}

const TREES = [
  { x: 64, y: 54, r: 34 },
  { x: 96, y: 300, r: 22 },
  { x: 30, y: 330, r: 26 },
  { x: 120, y: 4, r: 20 },
  { x: 596, y: 46, r: 28 },
  { x: 612, y: 336, r: 18 },
  { x: 600, y: 120, r: 13 },
];

/**
 * A solar panel as one looks from above: a dark blue-black face of cells in
 * a grid, a thin silver frame and a faint sheen. Strung, it takes its
 * string's colour as the designer shows it; picked, an orange edge.
 */
export function SolarPanel({ x, y, w, h, tint, picked }: { x: number; y: number; w: number; h: number; tint?: string; picked?: boolean }) {
  const cols = 6;
  const rows = 10;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={tint ?? "#141c2b"} fillOpacity={tint ? 0.78 : 1} />
      {!tint && <rect x={x} y={y} width={w} height={h} fill="url(#aer-panel-sheen)" />}
      <g stroke={tint ? "#0b0c0e" : "#2c3a52"} strokeWidth="0.35" opacity={tint ? 0.35 : 0.9}>
        {Array.from({ length: cols - 1 }, (_, i) => (
          <line key={`c${i}`} x1={x + ((i + 1) * w) / cols} y1={y} x2={x + ((i + 1) * w) / cols} y2={y + h} />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <line key={`r${i}`} x1={x} y1={y + ((i + 1) * h) / rows} x2={x + w} y2={y + ((i + 1) * h) / rows} />
        ))}
      </g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={picked ? "var(--sun-line)" : (tint ?? "#c9ced6")}
        strokeWidth={picked ? 1.2 : 0.7}
      />
    </g>
  );
}

/** The panels' sheen, defined once beside the scene. */
export function PanelDefs() {
  return (
    <defs>
      <linearGradient id="aer-panel-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5b7aa8" stopOpacity="0.28" />
        <stop offset="0.45" stopColor="#5b7aa8" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.15" />
      </linearGradient>
    </defs>
  );
}
