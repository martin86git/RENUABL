"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { SolMark, SunBrainLines } from "./sol-icon";

/**
 * Sol as a real sun (18 Nov 2026, Martin: the glossy orb felt "built in an entry level design tool"; take the feel up a
 * notch, and no rays like a child draws). Drawn live in WebGL: a white-hot core darkening to orange at the limb, a
 * surface that slowly churns (granulation, from 3D noise on the sphere as it turns), and a corona of soft haze that
 * breathes and drifts outward. No outline, no gloss, no spikes. The canvas is transparent, so it sits on white or black.
 *
 * Runs only while on screen; with reduced motion it draws one still frame. Where WebGL isn't available it falls back to
 * the flat mark. The sun's disc fills `DISC` of the canvas's half-width, leaving room for the corona.
 */

/** The disc's radius as a share of the canvas's half-width. */
export const DISC = 0.5;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;

// 3D simplex noise (Ashima Arts, MIT).
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float f=0.0, a=0.5; for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; } return f; }

void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/(0.5*min(uRes.x,uRes.y));
  float R=${DISC.toFixed(3)};
  float r=length(uv);
  float t=uTime;
  vec3 col=vec3(0.0); float alpha=0.0;

  // The edge is a ball of energy, not a clean ball (21 Nov 2026, Martin: "starting to look like a basketball… the edge
  // is too clean"): the limb boils, its radius stirred by noise round the sun and through time, and melts into the
  // corona over a wide band instead of ending in a hard line.
  float ang=atan(uv.y,uv.x);
  vec3 ep=vec3(cos(ang)*2.2,sin(ang)*2.2,t*0.16);
  float boil=fbm(ep)+0.5*snoise(vec3(cos(ang)*7.0,sin(ang)*7.0,t*0.45));
  float Re=R*(1.0+0.035*boil);

  if(r<Re+0.06){
    // The disc: a turning sphere, finely granulated, warmer towards the limb rather than dark, so it glows like a star.
    vec2 q=uv/R; float z=sqrt(max(0.0,1.0-min(1.0,dot(q,q))));
    float a=t*0.035; mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));
    vec3 s=vec3(rot*q.xy,z);
    float gran=fbm(s*9.0+vec3(0.0,0.0,t*0.05));
    float cells=snoise(s*34.0+t*0.12);
    float limb=pow(z,0.3);
    float heat=limb*(0.95+0.08*gran+0.03*cells)*(0.96+0.06*uEnergy);
    vec3 rim=vec3(1.0,0.36,0.07);
    vec3 mid=vec3(1.0,0.54,0.14);
    vec3 core=vec3(1.0,0.90,0.62);
    col=mix(rim,mid,smoothstep(0.10,0.60,heat));
    col=mix(col,core,smoothstep(0.70,1.02,heat));
    alpha=smoothstep(Re+0.028,Re-0.04,r);
  }

  // The corona: a soft haze breathing and drifting outward, bright where it leaves the limb, fading to nothing before
  // the canvas's edge, with fine flickers of flame close in. No spikes.
  float d=max(0.0,r-Re);
  vec3 cp=vec3(cos(ang)*1.5,sin(ang)*1.5,d*2.4-t*0.07);
  float wisps=fbm(cp)*0.5+0.5;
  float flick=fbm(vec3(cos(ang)*5.0,sin(ang)*5.0,d*9.0-t*0.5))*0.5+0.5;
  float breathe=0.93+0.07*sin(t*0.6);
  float inner=exp(-d*13.0)*(0.62+0.38*flick);
  float haze=exp(-d*5.0)*(0.22+0.32*wisps)*breathe*(0.9+0.25*uEnergy);
  float bloom=exp(-d*2.2)*0.08;
  float fade=smoothstep(1.0,0.72,r);
  float glow=(inner+haze+bloom)*fade;
  vec3 gcol=mix(vec3(1.0,0.40,0.10),vec3(1.0,0.74,0.40),exp(-d*9.0));
  vec3 outc=col*alpha+gcol*glow*(1.0-alpha);
  float outa=clamp(alpha+glow*(1.0-alpha),0.0,1.0);
  gl_FragColor=vec4(outc,outa);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
  return s;
}

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

  if (failed) return <SolMark className={clsx("size-full", className)} />;
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
