"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import clsx from "clsx";
import { MONTH_MID_DAYS, heightAt, sunPosition, type Terrain } from "@/lib/domain/design/shade";

/** A panel as the 3D view stands it on the roof: where (the designer's metres), its size, its tilt and the way it faces. */
export interface Panel3d {
  x: number;
  y: number;
  tilt: number;
  facing: number;
  long: number;
  short: number;
}

const SEASONS = [
  { name: "Summer", day: MONTH_MID_DAYS[11] + 6 },
  { name: "Autumn", day: MONTH_MID_DAYS[2] + 6 },
  { name: "Winter", day: MONTH_MID_DAYS[5] + 6 },
] as const;

const clock = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/**
 * The roof and everything around it in three dimensions, to show a design
 * off: the ground, the buildings and the trees as Google's height data has
 * them, with the design's panels standing on the roof, lit by the sun where
 * it really is at the time and season chosen, so the shadows fall where they
 * would. It can be turned and tilted by dragging, zoomed, and the day played
 * through. A way of looking, not of editing: closing it goes back to the
 * design. The model is Google's, and can be older than the roof; it says so.
 */
export function Roof3d(props: {
  terrain: Terrain;
  latitude: number;
  panels: Panel3d[];
  /** The plain drawing of the ground, and Google's own aerial photo: the model wears one or the other. */
  drawing: string;
  aerial: string;
  onClose: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [hour, setHour] = useState(10);
  const [season, setSeason] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [skin, setSkin] = useState<"drawing" | "aerial">("drawing");
  const [failed, setFailed] = useState(false);
  // What the scene needs told when a control changes: set once it is built.
  const api = useRef<{ sun: (hour: number, day: number) => void; skin: (which: "drawing" | "aerial") => void } | null>(null);
  const { terrain, latitude, panels, drawing, aerial } = props;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let gone = false;
    let stop = () => {};
    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (gone) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";

        const scene = new THREE.Scene();
        // The sky is the page's own (a soft gradient behind the picture): the scene itself has no backdrop.
        scene.fog = new THREE.Fog("#dfeaf4", 170, 380);

        // --- the ground, the buildings and the trees: one surface from the grid of heights
        const { cols, rows, cell, widthM, heightM } = terrain;
        // The heights as measured are rough (a treetop is a scatter of spikes): each takes the middle of the nine round it,
        // which drops the spikes and keeps a roof's edge, and is then eased a little so slopes read as slopes.
        const tidy = (from: Float32Array, pick: (nine: number[]) => number) => {
          const out = new Float32Array(from.length);
          const nine = new Array<number>(9);
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
              let n = 0;
              for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++)
                  nine[n++] = from[Math.min(rows - 1, Math.max(0, r + dr)) * cols + Math.min(cols - 1, Math.max(0, c + dc))];
              out[r * cols + c] = pick(nine);
            }
          return out;
        };
        const middle = (nine: number[]) => [...nine].sort((a, b) => a - b)[4];
        const eased = (nine: number[]) => (nine[4] * 4 + nine[1] + nine[3] + nine[5] + nine[7]) / 8;
        const heights = tidy(tidy(terrain.heights, middle), eased);
        const shown = { ...terrain, heights };
        const geometry = new THREE.BufferGeometry();
        const position = new Float32Array(cols * rows * 3);
        const uv = new Float32Array(cols * rows * 2);
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            position[i * 3] = (c + 0.5) * cell - widthM / 2;
            position[i * 3 + 1] = heights[i];
            position[i * 3 + 2] = (r + 0.5) * cell - heightM / 2;
            uv[i * 2] = (c + 0.5) / cols;
            uv[i * 2 + 1] = 1 - (r + 0.5) / rows;
          }
        const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
        let k = 0;
        for (let r = 0; r < rows - 1; r++)
          for (let c = 0; c < cols - 1; c++) {
            const a = r * cols + c;
            index.set([a, a + cols, a + 1, a + 1, a + cols, a + cols + 1], k);
            k += 6;
          }
        geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geometry.setIndex(new THREE.BufferAttribute(index, 1));
        geometry.computeVertexNormals();

        const loader = new THREE.TextureLoader();
        const wear = (url: string) => {
          const texture = loader.load(url);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          return texture;
        };
        const skins = { drawing: wear(drawing), aerial: wear(aerial) };
        const ground = new THREE.MeshStandardMaterial({ map: skins.drawing, roughness: 0.96, metalness: 0 });
        const land = new THREE.Mesh(geometry, ground);
        land.castShadow = true;
        land.receiveShadow = true;
        scene.add(land);

        // The block it stands on: sides down to a base, so it reads as a model on a table rather than a sheet.
        let low = Infinity;
        for (const h of heights) if (h < low) low = h;
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(widthM - cell, 3, heightM - cell),
          new THREE.MeshStandardMaterial({ color: "#3b3f45", roughness: 1 }),
        );
        base.position.set(0, low - 1.52, 0);
        base.receiveShadow = true;
        scene.add(base);

        // --- the design's panels, standing on the roof
        if (panels.length) {
          const glass = new THREE.MeshPhysicalMaterial({
            color: "#0b1424",
            roughness: 0.22,
            metalness: 0.55,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
          });
          const sized = new Map<string, Panel3d[]>();
          for (const p of panels) sized.set(`${p.long}x${p.short}`, [...(sized.get(`${p.long}x${p.short}`) ?? []), p]);
          const place = new THREE.Object3D();
          place.rotation.order = "YXZ";
          for (const group of sized.values()) {
            const { long, short } = group[0];
            const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(short - 0.02, 0.045, long - 0.02), glass, group.length);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.forEach((p, i) => {
              // The roof under it: the highest reading close by, so a panel never sinks into a rough patch of the model.
              let top = heightAt(shown, p.x, p.y);
              for (const [dx, dy] of [
                [0.4, 0],
                [-0.4, 0],
                [0, 0.4],
                [0, -0.4],
              ])
                top = Math.max(top, heightAt(shown, p.x + dx, p.y + dy));
              place.position.set(p.x, top + 0.12, p.y);
              // Facing north by default (its low edge to -z); tilted, then turned to the way it faces.
              place.rotation.set((-p.tilt * Math.PI) / 180, (-p.facing * Math.PI) / 180, 0);
              place.updateMatrix();
              mesh.setMatrixAt(i, place.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            scene.add(mesh);
          }
        }

        // --- the light: the sky, and the sun where it really is
        const sky = new THREE.HemisphereLight("#e6f0fb", "#5c6b4e", 0.95);
        scene.add(sky);
        const sun = new THREE.DirectionalLight("#fff4e0", 2.6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        const span = Math.hypot(widthM, heightM) / 2 + 6;
        Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 400 });
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.06;
        scene.add(sun, sun.target);
        const centreHeight = heightAt(shown, 0, 0);
        sun.target.position.set(0, centreHeight, 0);

        const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
        // From the north-east and above: the sunny side of a roof in the southern half of the world.
        const north = latitude < 0 ? -1 : 1;
        camera.position.set(46, centreHeight + 74, north * 66);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, centreHeight + 1, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.47;
        controls.minDistance = 14;
        controls.maxDistance = 170;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.55;
        // Once it has been taken hold of, it stops turning by itself.
        controls.addEventListener("start", () => (controls.autoRotate = false));

        const size = () => {
          const w = el.clientWidth || 1;
          const h = el.clientHeight || 1;
          renderer.setSize(w, h, false);
          renderer.domElement.style.width = "100%";
          renderer.domElement.style.height = "100%";
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        size();
        const watching = new ResizeObserver(size);
        watching.observe(el);

        api.current = {
          sun: (h, day) => {
            const at = sunPosition(latitude, day, h);
            const el2 = (Math.max(1, at.elevation) * Math.PI) / 180;
            const az = (at.azimuth * Math.PI) / 180;
            // East is +x, north is -z, up is +y.
            sun.position.set(Math.sin(az) * Math.cos(el2) * 160, centreHeight + Math.sin(el2) * 160, -Math.cos(az) * Math.cos(el2) * 160);
            // Low sun is weaker and warmer; below the horizon there is only the sky's light.
            const strength = at.elevation <= 0 ? 0 : Math.min(1, at.elevation / 28);
            sun.intensity = 0.6 + 2.5 * strength;
            sun.color.set(at.elevation < 14 ? "#ffd2a1" : "#fff4e0");
          },
          skin: (which) => {
            ground.map = skins[which];
            // Google's aerial photo is dark, with its own shadows in it: it is lifted so the model doesn't read as dusk.
            ground.emissiveMap = which === "aerial" ? skins.aerial : null;
            ground.emissive.set(which === "aerial" ? "#ffffff" : "#000000");
            ground.emissiveIntensity = which === "aerial" ? 0.55 : 0;
            ground.needsUpdate = true;
          },
        };

        let frame = 0;
        const draw = () => {
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(draw);
        };
        draw();
        stop = () => {
          cancelAnimationFrame(frame);
          watching.disconnect();
          controls.dispose();
          geometry.dispose();
          ground.dispose();
          skins.drawing.dispose();
          skins.aerial.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          api.current = null;
        };
        if (gone) stop();
      } catch {
        if (!gone) setFailed(true);
      }
    })();
    return () => {
      gone = true;
      stop();
    };
  }, [terrain, latitude, panels, drawing, aerial]);

  // The controls, told to the scene as they change (and once it is built: it may arrive after the first of these).
  useEffect(() => {
    let tries = 0;
    const tell = () => {
      if (api.current) {
        api.current.sun(hour, SEASONS[season].day);
        api.current.skin(skin);
      } else if (tries++ < 80) timer = window.setTimeout(tell, 50);
    };
    let timer = window.setTimeout(tell, 0);
    return () => window.clearTimeout(timer);
  }, [hour, season, skin]);

  // Playing: the day runs from early morning to evening and round again.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setHour((h) => (h >= 18.5 ? 6 : Math.round((h + 0.1) * 10) / 10)), 60);
    return () => window.clearInterval(timer);
  }, [playing]);

  const plate = "rounded-2xl border border-line bg-surface/90 shadow-lift backdrop-blur-md";
  return (
    <div
      className="absolute inset-0 z-30 overflow-hidden rounded-lg bg-[linear-gradient(180deg,#b9d3ea_0%,#dfeaf4_55%,#f3f5f7_100%)]"
      role="region"
      aria-label="The roof in 3D"
    >
      <div ref={holder} className="absolute inset-0" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2">
          This browser couldn&apos;t draw the 3D view. Close it to go back to the design.
        </p>
      )}
      <button
        onClick={props.onClose}
        className={clsx(plate, "absolute right-3 top-3 flex h-11 items-center gap-2 px-4 text-sm font-medium text-ink hover:bg-surface")}
      >
        <X className="size-4" aria-hidden /> Back to the design
      </button>
      <p className={clsx(plate, "absolute left-3 top-3 max-w-[19rem] px-3 py-2 text-xs leading-snug text-ink-2")}>
        <span className="block text-[13px] font-medium text-ink">Drag to turn it. Scroll to zoom.</span>
        The model is Google&apos;s height data for this address, and can be older than the roof. Shadows are where the sun would cast them.
      </p>
      <div
        className={clsx(
          plate,
          "absolute bottom-3 left-1/2 flex w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
        )}
      >
        <button
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Stop the day" : "Play the day"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sun-line text-white hover:brightness-105"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <label className="flex min-w-48 flex-1 items-center gap-3 text-xs text-ink-2">
          <span className="w-16 shrink-0 text-[13px] font-medium tabular-nums text-ink">{clock(hour)}</span>
          <input
            type="range"
            min={5}
            max={19}
            step={0.1}
            value={hour}
            aria-label="Time of day"
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            className="block w-full"
          />
        </label>
        <div className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5" role="group" aria-label="Season">
          {SEASONS.map((s, i) => (
            <button
              key={s.name}
              aria-pressed={season === i}
              onClick={() => setSeason(i)}
              className={clsx(
                "h-8 rounded px-2.5 text-[13px] font-medium",
                season === i ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5" role="group" aria-label="What the model wears">
          {(
            [
              ["drawing", "Model"],
              ["aerial", "Photo"],
            ] as const
          ).map(([which, name]) => (
            <button
              key={which}
              aria-pressed={skin === which}
              onClick={() => setSkin(which)}
              className={clsx(
                "h-8 rounded px-2.5 text-[13px] font-medium",
                skin === which ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
