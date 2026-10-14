"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import clsx from "clsx";
import { faceUnder, roofHeightAt, type Scene, type SceneFace } from "@/lib/domain/design/scene";
import { MONTH_MID_DAYS, sunPosition } from "@/lib/domain/design/shade";

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

/** The model's colours: a calm architectural palette, the panels the only dark glass in it. */
const COLOUR = {
  lawn: "#8fae78",
  wall: "#f3f0ea",
  roof: "#8a9099",
  ownRoof: "#a3a9b1",
  neighbourWall: "#e7e3dc",
  neighbourRoof: "#b5b9bf",
  trunk: "#6e5643",
  crowns: ["#5f8a4c", "#55804a", "#6b9354", "#4e7744", "#62874f"],
  table: "#2f3338",
  edge: "#20242a",
};

/** Whether a point is inside a building's turned rectangle, grown by a margin. */
const inRect = (b: Scene["buildings"][number], p: { x: number; y: number }, margin = 0.5) => {
  const t = (b.angle * Math.PI) / 180;
  const dx = p.x - b.cx;
  const dy = p.y - b.cy;
  const u = dx * Math.cos(t) + dy * Math.sin(t);
  const v = -dx * Math.sin(t) + dy * Math.cos(t);
  return Math.abs(u) <= b.long / 2 + margin && Math.abs(v) <= b.wide / 2 + margin;
};

/**
 * The roof and its street as a clean model, to show a design off: the home
 * built from its own roof faces (each a plane rising from the walls at its
 * pitch, the walls at the height of its storeys), the buildings next door as
 * walls under hipped roofs, and the trees as trunks under round crowns, all
 * where Google's measurements put them and as tall. The design's panels
 * stand on the home's roof at its pitch. The sun is where it really is at the
 * hour and season chosen, and casts real shadows. It turns and zooms and the
 * day can be played through; it is a way of looking, never of editing.
 */
export function Roof3d(props: {
  scene: Scene;
  /** The home's roof faces: the ones traced, or Google's until some are. */
  faces: SceneFace[];
  /** How high the home's walls stand, metres. */
  eave: number;
  latitude: number;
  panels: Panel3d[];
  /** The ground's two looks: the plain drawing of it, and the satellite photo. Both cover the designer's picture. */
  drawing: string;
  photo: string;
  /** The designer's picture on the ground, metres. */
  widthM: number;
  heightM: number;
  onClose: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [hour, setHour] = useState(10);
  const [season, setSeason] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [skin, setSkin] = useState<"drawing" | "photo">("drawing");
  const [failed, setFailed] = useState(false);
  const api = useRef<{ sun: (hour: number, day: number) => void; skin: (which: "drawing" | "photo") => void } | null>(null);
  const { scene, faces, eave, latitude, panels, drawing, photo, widthM, heightM } = props;

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
        const disposables: { dispose: () => void }[] = [];
        const keep = <T extends { dispose: () => void }>(thing: T) => {
          disposables.push(thing);
          return thing;
        };

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.display = "block";
        el.appendChild(renderer.domElement);
        const scene3 = new THREE.Scene();
        scene3.fog = new THREE.Fog("#e7eef5", 150, 340);

        // Three's axes: x east, y up, z south (the designer's y). A point on the ground at height h:
        const v3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, y);
        const solid = (colour: string, rough = 0.85) =>
          keep(new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: 0 }));
        const edges = keep(new THREE.LineBasicMaterial({ color: COLOUR.edge, transparent: true, opacity: 0.22 }));
        const outline = (geometry: ConstructorParameters<typeof THREE.EdgesGeometry>[0], at?: InstanceType<typeof THREE.Object3D>) => {
          const lines = new THREE.LineSegments(keep(new THREE.EdgesGeometry(geometry, 20)), edges);
          if (at) {
            lines.position.copy(at.position);
            lines.rotation.copy(at.rotation);
          }
          scene3.add(lines);
        };

        // --- the ground: the designer's picture laid flat, on a block like a model on a table
        const loader = new THREE.TextureLoader();
        const wear = (url: string) => {
          const texture = keep(loader.load(url));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          return texture;
        };
        const looks = { drawing: wear(drawing), photo: wear(photo) };
        const groundMaterial = keep(new THREE.MeshStandardMaterial({ map: looks.drawing, roughness: 1 }));
        const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(widthM, heightM)), groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene3.add(ground);
        const table = new THREE.Mesh(keep(new THREE.BoxGeometry(widthM + 0.02, 2.4, heightM + 0.02)), solid(COLOUR.table, 1));
        table.position.y = -1.21;
        table.receiveShadow = true;
        scene3.add(table);

        // --- the buildings next door: walls under a hipped roof, turned to fit their outline
        const own = faces.flatMap((f) => f.points);
        const ownMiddle = own.length
          ? { x: own.reduce((n, p) => n + p.x, 0) / own.length, y: own.reduce((n, p) => n + p.y, 0) / own.length }
          : { x: 0, y: 0 };
        const wallMaterial = solid(COLOUR.neighbourWall, 0.9);
        const neighbourRoof = solid(COLOUR.neighbourRoof, 0.75);
        for (const b of scene.buildings) {
          // The home is drawn from its own faces: Google's outline of it (which can be of an older house) is left out.
          if (own.length && (own.some((p) => inRect(b, p, 0.3)) || inRect(b, ownMiddle, 1))) continue;
          const turn = (-b.angle * Math.PI) / 180;
          const walls = new THREE.Mesh(keep(new THREE.BoxGeometry(b.long, b.eave, b.wide)), wallMaterial);
          walls.position.set(b.cx, b.eave / 2, b.cy);
          walls.rotation.y = turn;
          walls.castShadow = walls.receiveShadow = true;
          scene3.add(walls);
          outline(walls.geometry, walls);
          // The hip: the ridge runs along the length, a half-width in from each end, at the ridge's height.
          const over = 0.35;
          const L = b.long / 2 + over;
          const W = b.wide / 2 + over;
          const rise = Math.max(0.6, Math.min(b.ridge - b.eave, b.wide * 0.45));
          const r = Math.max(0, L - W);
          const roof = new THREE.BufferGeometry();
          const corners = [
            [-L, 0, -W],
            [L, 0, -W],
            [L, 0, W],
            [-L, 0, W],
            [-r, rise, 0],
            [r, rise, 0],
          ].flat();
          roof.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
          roof.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0]);
          roof.computeVertexNormals();
          const hip = new THREE.Mesh(keep(roof), neighbourRoof);
          hip.position.set(b.cx, b.eave, b.cy);
          hip.rotation.y = turn;
          hip.castShadow = hip.receiveShadow = true;
          scene3.add(hip);
          outline(roof, hip);
        }

        // --- the trees: trunks under round crowns, each its own size and a green of its own
        if (scene.trees.length) {
          const crownGeometry = keep(new THREE.IcosahedronGeometry(1, 2));
          const trunkGeometry = keep(new THREE.CylinderGeometry(0.75, 1, 1, 7));
          const crownMaterial = keep(new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }));
          const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, scene.trees.length);
          const trunks = new THREE.InstancedMesh(trunkGeometry, solid(COLOUR.trunk, 1), scene.trees.length);
          const place = new THREE.Object3D();
          const tint = new THREE.Color();
          scene.trees.forEach((t, i) => {
            const crownDepth = Math.min(t.height * 0.72, Math.max(t.radius * 1.6, 2));
            const base = Math.max(0.6, t.height - crownDepth);
            place.position.set(t.x, base + crownDepth / 2, t.y);
            place.scale.set(t.radius, crownDepth / 2, t.radius);
            place.rotation.set(0, (i * 1.7) % Math.PI, 0);
            place.updateMatrix();
            crowns.setMatrixAt(i, place.matrix);
            crowns.setColorAt(i, tint.set(COLOUR.crowns[i % COLOUR.crowns.length]));
            const girth = Math.min(0.45, 0.12 + t.height * 0.02);
            place.position.set(t.x, (base + crownDepth * 0.25) / 2, t.y);
            place.scale.set(girth, base + crownDepth * 0.25, girth);
            place.rotation.set(0, 0, 0);
            place.updateMatrix();
            trunks.setMatrixAt(i, place.matrix);
          });
          crowns.castShadow = crowns.receiveShadow = true;
          trunks.castShadow = true;
          scene3.add(crowns, trunks);
        }

        // --- the home: walls round its roof, and each roof face a plane rising from the walls at its pitch
        if (faces.length) {
          const roofMaterial = keep(new THREE.MeshStandardMaterial({ color: COLOUR.ownRoof, roughness: 0.7, side: THREE.DoubleSide }));
          const flatOutline = (() => {
            // The walls follow the outline round every face's corners.
            const pts = [...own].sort((a, b) => a.x - b.x || a.y - b.y);
            const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
              (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
            const half = (list: typeof pts) => {
              const out: typeof pts = [];
              for (const p of list) {
                while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
                out.push(p);
              }
              out.pop();
              return out;
            };
            return [...half(pts), ...half([...pts].reverse())];
          })();
          // Walls: a band from the ground to the eaves along the outline.
          const wallPositions: number[] = [];
          for (let i = 0; i < flatOutline.length; i++) {
            const a = flatOutline[i];
            const b = flatOutline[(i + 1) % flatOutline.length];
            const [a0, b0, a1, b1] = [v3(a.x, a.y, 0), v3(b.x, b.y, 0), v3(a.x, a.y, eave), v3(b.x, b.y, eave)];
            wallPositions.push(...a0.toArray(), ...b0.toArray(), ...b1.toArray(), ...a0.toArray(), ...b1.toArray(), ...a1.toArray());
          }
          const wallGeometry = keep(new THREE.BufferGeometry());
          wallGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wallPositions, 3));
          wallGeometry.computeVertexNormals();
          const walls = new THREE.Mesh(
            wallGeometry,
            keep(new THREE.MeshStandardMaterial({ color: COLOUR.wall, roughness: 0.9, side: THREE.DoubleSide })),
          );
          walls.castShadow = walls.receiveShadow = true;
          scene3.add(walls);
          // Each face: its outline lifted onto its own plane, and its edges closed down to the eaves (the gables).
          for (const face of faces) {
            if (face.points.length < 3) continue;
            const lift = (p: { x: number; y: number }) => roofHeightAt(face, eave, p);
            const flat = face.points.map((p) => new THREE.Vector2(p.x, p.y));
            const triangles = THREE.ShapeUtils.triangulateShape(flat, []);
            const positions = face.points.flatMap((p) => v3(p.x, p.y, lift(p)).toArray());
            const geometry = keep(new THREE.BufferGeometry());
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            geometry.setIndex(triangles.flat());
            geometry.computeVertexNormals();
            const plane = new THREE.Mesh(geometry, roofMaterial);
            plane.castShadow = plane.receiveShadow = true;
            scene3.add(plane);
            outline(geometry);
            const skirt: number[] = [];
            for (let i = 0; i < face.points.length; i++) {
              const a = face.points[i];
              const b = face.points[(i + 1) % face.points.length];
              const [ha, hb] = [lift(a), lift(b)];
              if (ha - eave < 0.05 && hb - eave < 0.05) continue;
              skirt.push(...v3(a.x, a.y, eave).toArray(), ...v3(b.x, b.y, eave).toArray(), ...v3(b.x, b.y, hb).toArray());
              skirt.push(...v3(a.x, a.y, eave).toArray(), ...v3(b.x, b.y, hb).toArray(), ...v3(a.x, a.y, ha).toArray());
            }
            if (skirt.length) {
              const gable = keep(new THREE.BufferGeometry());
              gable.setAttribute("position", new THREE.Float32BufferAttribute(skirt, 3));
              gable.computeVertexNormals();
              const g = new THREE.Mesh(
                gable,
                keep(new THREE.MeshStandardMaterial({ color: COLOUR.wall, roughness: 0.9, side: THREE.DoubleSide })),
              );
              g.castShadow = true;
              scene3.add(g);
            }
          }
        }

        // --- the design's panels, on the home's roof at its pitch
        if (panels.length) {
          const glass = keep(
            new THREE.MeshPhysicalMaterial({ color: "#0c1626", roughness: 0.18, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 }),
          );
          const frame = keep(new THREE.MeshStandardMaterial({ color: "#c9ced6", roughness: 0.4, metalness: 0.6 }));
          const { long, short } = panels[0];
          const cells = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(short - 0.06, 0.035, long - 0.06)), glass, panels.length);
          const rims = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(short - 0.01, 0.03, long - 0.01)), frame, panels.length);
          const place = new THREE.Object3D();
          place.rotation.order = "YXZ";
          panels.forEach((p, i) => {
            const face = faceUnder(faces, p);
            const h = face ? roofHeightAt(face, eave, p) : eave + 0.2;
            // On a pitched face a panel lies flush with it, as it is mounted; on a flat one (tilt frames) it keeps its own tilt.
            const flush = face && face.tilt >= 3;
            const tilt = flush ? face.tilt : p.tilt;
            const facing = flush ? face.facing : p.facing;
            // Lifted clear of the roof by its own frame, plus what its tilt raises its far edge on a flat roof.
            const lift = 0.09 + (flush ? 0 : (Math.sin((tilt * Math.PI) / 180) * p.long) / 2);
            place.position.set(p.x, h + lift, p.y);
            place.rotation.set((-tilt * Math.PI) / 180, (-facing * Math.PI) / 180, 0);
            place.updateMatrix();
            cells.setMatrixAt(i, place.matrix);
            place.position.y -= 0.012;
            place.updateMatrix();
            rims.setMatrixAt(i, place.matrix);
          });
          cells.castShadow = rims.castShadow = true;
          cells.receiveShadow = true;
          scene3.add(cells, rims);
        }

        // --- the light: the sky, and the sun where it really is
        scene3.add(new THREE.HemisphereLight("#eef4fb", "#7d8f6a", 1.05));
        const sun = new THREE.DirectionalLight("#fff6e8", 2.4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(4096, 4096);
        const span = Math.hypot(widthM, heightM) / 2 + 4;
        Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 420 });
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.radius = 3;
        scene3.add(sun, sun.target);

        const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 700);
        // From the sunny side and above: north-east in the southern half of the world.
        const sunny = latitude < 0 ? -1 : 1;
        const look = v3(ownMiddle.x, ownMiddle.y, eave);
        camera.position.set(look.x + 34, 40, look.z + sunny * 44);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(look);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.46;
        controls.minDistance = 12;
        controls.maxDistance = 150;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.45;
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
            sun.position.set(look.x + Math.sin(az) * Math.cos(el2) * 180, Math.sin(el2) * 180, look.z - Math.cos(az) * Math.cos(el2) * 180);
            sun.target.position.copy(look);
            const strength = at.elevation <= 0 ? 0 : Math.min(1, at.elevation / 25);
            sun.intensity = 0.4 + 2.4 * strength;
            sun.color.set(at.elevation < 12 ? "#ffcf9a" : "#fff6e8");
          },
          skin: (which) => {
            groundMaterial.map = looks[which];
            groundMaterial.needsUpdate = true;
          },
        };

        let frame = 0;
        const draw = () => {
          controls.update();
          renderer.render(scene3, camera);
          frame = requestAnimationFrame(draw);
        };
        draw();
        stop = () => {
          cancelAnimationFrame(frame);
          watching.disconnect();
          controls.dispose();
          for (const thing of disposables) thing.dispose();
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
  }, [scene, faces, eave, latitude, panels, drawing, photo, widthM, heightM]);

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
  const pill = (on: boolean) =>
    clsx(
      "h-8 rounded px-2.5 text-[13px] font-medium",
      on ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-ink-2 hover:text-ink",
    );
  return (
    <div
      className="absolute inset-0 z-30 overflow-hidden rounded-lg bg-[linear-gradient(180deg,#bcd5ec_0%,#e3edf6_55%,#f4f6f8_100%)]"
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
        <span className="block text-[13px] font-medium text-ink">Drag to turn it. Scroll to zoom.</span>A model of the home from its traced
        roof, with the buildings and trees around it where Google&apos;s measurements put them. Shadows fall where the sun would cast them.
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
            <button key={s.name} aria-pressed={season === i} onClick={() => setSeason(i)} className={pill(season === i)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-md bg-surface-2 p-0.5" role="group" aria-label="The ground">
          {(
            [
              ["drawing", "Drawn"],
              ["photo", "Photo"],
            ] as const
          ).map(([which, name]) => (
            <button key={which} aria-pressed={skin === which} onClick={() => setSkin(which)} className={pill(skin === which)}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
