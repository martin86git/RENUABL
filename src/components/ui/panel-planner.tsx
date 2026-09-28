"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { boxPixels, type Obstruction } from "@/lib/domain/obstructions";
import { offset, panelAtPixel, panelCorners, rotationTowards, snapPanel, type PlacedPanel } from "@/lib/domain/panel-plan";
import { PANEL } from "@/lib/domain/catalogue";
import { designView, metresPerPixel, toPixel } from "@/lib/domain/roof-layout";

type Drag =
  | { kind: "move"; index: number; dx: number; dy: number; moved: boolean }
  | { kind: "rotate"; index: number }
  | { kind: "pan"; x: number; y: number; cx: number; cy: number };

/**
 * Panels on the satellite photo, placed by hand. Editable: drag a panel to
 * move it (it snaps beside a neighbour), drag its round handle to rotate it,
 * drag the photo to look around. Read-only for customers. Positions are on
 * the Maps Static photo shown here, so what the partner sees is what's saved.
 */
export function PanelPlanner({
  centre,
  imageSrc,
  panels,
  onChange,
  selected = null,
  onSelect,
  zoomM = 32,
  obstructions = [],
  flagged = [],
  className,
}: {
  centre: { lat: number; lng: number };
  imageSrc: string;
  panels: PlacedPanel[];
  /** Given: the plan can be edited. */
  onChange?: (panels: PlacedPanel[]) => void;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  /** How much ground the view shows across, metres. */
  zoomM?: number;
  obstructions?: Obstruction[];
  /** Panels (indexes) on or next to an obstruction: outlined amber. */
  flagged?: number[];
  className?: string;
}) {
  const editable = Boolean(onChange);
  const view = useMemo(() => designView(centre), [centre]);
  const full = view.size * view.scale;
  const mpp = metresPerPixel(view);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<PlacedPanel[] | null>(null);
  const [look, setLook] = useState({ x: full / 2, y: full / 2 });
  const [imageFailed, setImageFailed] = useState(false);
  const shown = draft ?? panels;

  // The view: zoomM across, 4:3, centred where the partner has looked, inside the photo.
  const w = Math.min(full, zoomM / mpp);
  const h = w * 0.75;
  const x0 = Math.max(0, Math.min(full - w, look.x - w / 2));
  const y0 = Math.max(0, Math.min(full - h, look.y - h / 2));
  const k = w / 800; // line widths and handles keep the same size on screen at any zoom

  function point(e: ReactPointerEvent) {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function startMove(e: ReactPointerEvent, index: number) {
    if (!editable) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = point(e);
    const c = toPixel(shown[index].lat, shown[index].lng, view);
    onSelect?.(index);
    setDraft(shown);
    setDrag({ kind: "move", index, dx: c.x - p.x, dy: c.y - p.y, moved: false });
  }

  function startRotate(e: ReactPointerEvent, index: number) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraft(shown);
    setDrag({ kind: "rotate", index });
  }

  function startPan(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect?.(null);
    setDrag({ kind: "pan", x: e.clientX, y: e.clientY, cx: x0 + w / 2, cy: y0 + h / 2 });
  }

  function move(e: ReactPointerEvent) {
    if (!drag) return;
    if (drag.kind === "pan") {
      const rect = svg.current?.getBoundingClientRect();
      const scale = rect ? w / rect.width : 1;
      const clamp = (v: number, span: number) => Math.max(span / 2, Math.min(full - span / 2, v));
      setLook({ x: clamp(drag.cx - (e.clientX - drag.x) * scale, w), y: clamp(drag.cy - (e.clientY - drag.y) * scale, h) });
      return;
    }
    const p = point(e);
    setDraft((d) => {
      const list = [...(d ?? shown)];
      const panel = list[drag.index];
      list[drag.index] =
        drag.kind === "move"
          ? panelAtPixel(panel, p.x + drag.dx, p.y + drag.dy, view)
          : { ...panel, rotation: rotationTowards(panel, p.x, p.y, view) };
      return list;
    });
    if (drag.kind === "move" && !drag.moved) setDrag({ ...drag, moved: true });
  }

  function end() {
    if (drag && drag.kind !== "pan" && draft) {
      const list = [...draft];
      if (drag.kind === "move")
        list[drag.index] = snapPanel(
          list[drag.index],
          list.filter((_, i) => i !== drag.index),
        );
      onChange?.(list);
    }
    setDraft(null);
    setDrag(null);
  }

  const blocked = new Set(flagged);
  return (
    <div className={className}>
      <svg
        ref={svg}
        viewBox={`${x0} ${y0} ${w} ${h}`}
        className="block h-auto w-full select-none rounded-xl bg-[#2a2f33]"
        style={{ touchAction: editable ? "none" : "auto" }}
        role="img"
        aria-label={`Panel layout: ${shown.length} panels on the roof`}
        onPointerDown={editable ? startPan : undefined}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {!imageFailed && (
          <image href={imageSrc} x={0} y={0} width={full} height={full} preserveAspectRatio="none" onError={() => setImageFailed(true)} />
        )}
        {obstructions.map((o, i) => {
          const b = boxPixels(o, view);
          return (
            <rect
              key={`o${i}`}
              x={b.x0}
              y={b.y0}
              width={b.x1 - b.x0}
              height={b.y1 - b.y0}
              fill="#f5b54a"
              fillOpacity={0.18}
              stroke="#f5b54a"
              strokeWidth={2 * k}
              pointerEvents="none"
            />
          );
        })}
        {shown.map((p, i) => {
          const pts = panelCorners(p, view)
            .map((q) => `${q.x},${q.y}`)
            .join(" ");
          const isSelected = editable && selected === i;
          return (
            <polygon
              key={i}
              points={pts}
              fill="#15202b"
              fillOpacity={0.9}
              stroke={blocked.has(i) ? "#f5b54a" : isSelected ? "#ffffff" : "#c9d2da"}
              strokeWidth={(isSelected || blocked.has(i) ? 3 : 1.4) * k}
              style={{ touchAction: "none", cursor: editable ? "grab" : undefined }}
              onPointerDown={(e) => startMove(e, i)}
            />
          );
        })}
        {editable &&
          selected !== null &&
          shown[selected] &&
          (() => {
            const p = shown[selected];
            const t = (p.rotation * Math.PI) / 180;
            const top = offset(p, Math.sin(t) * (PANEL.heightM / 2), Math.cos(t) * (PANEL.heightM / 2));
            const knob = offset(p, Math.sin(t) * (PANEL.heightM / 2 + 1.1), Math.cos(t) * (PANEL.heightM / 2 + 1.1));
            const a = toPixel(top.lat, top.lng, view);
            const b = toPixel(knob.lat, knob.lng, view);
            return (
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth={2 * k} pointerEvents="none" />
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={11 * k}
                  fill="#ffffff"
                  stroke="#15202b"
                  strokeWidth={2 * k}
                  style={{ touchAction: "none", cursor: "grab" }}
                  onPointerDown={(e) => startRotate(e, selected)}
                >
                  <title>Drag to rotate</title>
                </circle>
              </g>
            );
          })()}
      </svg>
      {imageFailed && <p className="mt-1.5 text-[12px] text-muted">The satellite image didn&apos;t load; the layout is still to scale.</p>}
    </div>
  );
}
