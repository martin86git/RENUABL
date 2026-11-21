"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { SolMarkFlat, SunBrainLines } from "./sol-icon";
import { DISC, FRAG, VERT, compile } from "./sun-shader";

export { DISC };

/**
 * Sol as a real sun (18 Nov 2026, Martin: the glossy orb felt "built in an entry level design tool"; take the feel up a
 * notch, and no rays like a child draws). Drawn live in WebGL: a white-hot core darkening to orange at the limb, a
 * surface that slowly churns (granulation, from 3D noise on the sphere as it turns), and a corona of soft haze that
 * breathes and drifts outward. No outline, no gloss, no spikes. The canvas is transparent, so it sits on white or black.
 *
 * Runs only while on screen; with reduced motion it draws one still frame. Where WebGL isn't available it falls back to
 * the flat mark. The sun's disc fills `DISC` of the canvas's half-width, leaving room for the corona.
 */

/** The live sun. `energy` (0 to 1) brightens it and stirs the corona, for while Sol is talking or thinking. */
export function LiveSun({ className, energy = 0, live = true }: { className?: string; energy?: number; live?: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const energyRef = useRef(energy);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const gl = el.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) {
      const off = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(off);
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      const off = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(off);
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
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

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    let smoothed = energyRef.current;
    const begun = performance.now();

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(1, Math.round(el.clientWidth * dpr));
      const h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    const draw = (now: number) => {
      size();
      smoothed += (energyRef.current - smoothed) * 0.06;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, el.width, el.height);
      gl.uniform1f(uTime, still ? 12 : (now - begun) / 1000 + 12);
      gl.uniform1f(uEnergy, smoothed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const loop = (now: number) => {
      if (visible && live && !document.hidden) draw(now);
      frame = requestAnimationFrame(loop);
    };
    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
          })
        : null;
    io?.observe(el);
    if (still) draw(performance.now());
    else frame = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => draw(performance.now()));
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      ro.disconnect();
    };
  }, [live]);

  if (failed) return <SolMarkFlat className={clsx("size-full", className)} />;
  // The brain in the sun (18 Nov 2026, Martin: "a feint brain outline, to show it's a sun brain"): fine light lines
  // laid softly over the disc, a little brighter while he talks. On every live sun alike (21 Nov 2026, Martin: the
  // etched lines tried in its place weren't liked; "reinstate the previous look and make it consistent everywhere").
  // The disc is half the canvas across, in its middle.
  return (
    <span className="relative block size-full" aria-hidden>
      <canvas ref={canvas} className={clsx("block size-full", className)} />
      <span className="pointer-events-none absolute inset-1/4">
        <SunBrain lit={energy > 0.5} />
      </span>
    </span>
  );
}

/** The brain in the sun, the same lines as `SolMark`'s, a little brighter while he talks. */
function SunBrain({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="11 12 78 78"
      className={clsx("absolute inset-[2%] mix-blend-soft-light transition-opacity duration-700", lit ? "opacity-90" : "opacity-60")}
    >
      <SunBrainLines />
    </svg>
  );
}
