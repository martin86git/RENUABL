"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SolBadgeFlat, SolMarkFlat, SunBrainLines } from "./sol-icon";
import { FRAG, VERT, compile } from "./sun-shader";

/**
 * Every Sol in the product is the homepage's sun, a ball of energy (21 Nov 2026, Martin: "they all need to be the same
 * (in the product portal) as the sol on the homepage"). A page can hold dozens of him, and a browser allows only about
 * sixteen WebGL canvases, so one hidden WebGL canvas draws the sun and every Sol on screen copies its frame into a
 * plain canvas of its own. The drawing runs only while at least one is on screen, about 30 frames a second; with
 * reduced motion it draws one still frame. Where WebGL can't run, the flat drawing stands in.
 */

/** The shared canvas's size in pixels: enough for the largest Sol in the product, a 64 px round at twice the pixels. */
const SHARED_PX = 256;
const FRAME_MS = 33;

type Viewer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; visible: boolean; disc: boolean };

type Renderer = { canvas: HTMLCanvasElement; draw: (seconds: number) => void };

let renderer: Renderer | null | undefined;
const viewers = new Set<Viewer>();
let frame = 0;
let last = 0;
const begun = typeof performance === "undefined" ? 0 : performance.now();

function still(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function makeRenderer(): Renderer | null {
  const canvas = document.createElement("canvas");
  canvas.width = SHARED_PX;
  canvas.height = SHARED_PX;
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uEnergy = gl.getUniformLocation(prog, "uEnergy");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, SHARED_PX, SHARED_PX);
  return {
    canvas,
    draw(seconds) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, SHARED_PX, SHARED_PX);
      gl.uniform1f(uTime, seconds);
      gl.uniform1f(uEnergy, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

function sharedRenderer(): Renderer | null {
  if (renderer === undefined) renderer = makeRenderer();
  return renderer;
}

/** Copies the shared frame into one Sol's own canvas, sized to it; a Sol with no glow keeps only the disc. */
function paint(v: Viewer, from: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(v.canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(v.canvas.clientHeight * dpr));
  if (v.canvas.width !== w || v.canvas.height !== h) {
    v.canvas.width = w;
    v.canvas.height = h;
  }
  v.ctx.clearRect(0, 0, w, h);
  v.ctx.save();
  if (v.disc) {
    v.ctx.beginPath();
    v.ctx.arc(w / 2, h / 2, Math.min(w, h) / 4, 0, Math.PI * 2);
    v.ctx.clip();
  }
  v.ctx.drawImage(from, 0, 0, w, h);
  v.ctx.restore();
}

function drawAll(now: number) {
  const r = sharedRenderer();
  if (!r) return;
  r.draw(still() ? 12 : (now - begun) / 1000 + 12);
  for (const v of viewers) if (v.visible || still()) paint(v, r.canvas);
}

function loop(now: number) {
  frame = 0;
  if (viewers.size === 0) return;
  const anyVisible = [...viewers].some((v) => v.visible);
  if (anyVisible && !document.hidden && now - last >= FRAME_MS) {
    last = now;
    drawAll(now);
  }
  frame = requestAnimationFrame(loop);
}

function join(v: Viewer): () => void {
  viewers.add(v);
  if (still()) drawAll(performance.now());
  else if (!frame) frame = requestAnimationFrame(loop);
  return () => {
    viewers.delete(v);
    if (viewers.size === 0 && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** The live sun drawn into a canvas of its own, with the brain over its disc. Its disc is half the canvas across. */
function LiveCanvas({ disc, className }: { disc: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !sharedRenderer()) return;
    const v: Viewer = { canvas: el, ctx, visible: true, disc };
    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([e]) => {
            v.visible = e.isIntersecting;
            if (v.visible && still()) {
              const r = sharedRenderer();
              if (r) paint(v, r.canvas);
            }
          })
        : null;
    io?.observe(el);
    const leave = join(v);
    return () => {
      io?.disconnect();
      leave();
    };
  }, [disc]);
  return (
    <span className={className} aria-hidden>
      <canvas ref={ref} className="block size-full" />
      <span className="pointer-events-none absolute inset-1/4">
        <svg viewBox="11 12 78 78" className="absolute inset-[2%] opacity-60 mix-blend-soft-light">
          <SunBrainLines />
        </svg>
      </span>
    </span>
  );
}

/**
 * Sol himself, the same live sun as the homepage's at any size. The box it is given is his round: the disc fills
 * most of it and his glow spills softly past its edge. `glow={false}` keeps only the disc, for tight places.
 */
export function SolMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  return <LiveMark className={className} glow={glow} flat={<SolMarkFlat className="size-full" glow={glow} />} />;
}

/** Sol at small sizes, in a line of words or a box: the same live sun, the disc filling more of its box. */
export function SolBadge({ className }: { className?: string }) {
  return <LiveMark className={className} glow tight flat={<SolBadgeFlat className="size-full" />} />;
}

function LiveMark({ className, glow, tight = false, flat }: { className?: string; glow: boolean; tight?: boolean; flat: ReactNode }) {
  // Where WebGL can't run, the flat drawing stands in (asked after the page is up: the server can't know).
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (sharedRenderer()) return;
    const off = window.setTimeout(() => setBroken(true), 0);
    return () => window.clearTimeout(off);
  }, []);
  return (
    <span className={`sol-sun relative inline-block shrink-0 ${className ?? ""}`} aria-hidden>
      {broken ? (
        flat
      ) : (
        <LiveCanvas
          disc={!glow}
          // The disc is half the canvas across: 80% of the box for his round, 90% for a badge.
          className={`pointer-events-none absolute ${tight ? "-inset-[40%]" : "-inset-[30%]"}`}
        />
      )}
    </span>
  );
}
