/**
 * The 3D house view: Google's photorealistic 3D tiles (Map Tiles API) shown
 * with CesiumJS, loaded from its CDN only when someone opens the view.
 */
const CESIUM = "https://cdn.jsdelivr.net/npm/cesium@1.145.0/Build/Cesium";

/* eslint-disable @typescript-eslint/no-explicit-any -- CesiumJS is loaded at runtime from its CDN, without types */
let loading: Promise<any> | null = null;

function loadCesium(): Promise<any> {
  const w = window as any;
  if (w.Cesium) return Promise.resolve(w.Cesium);
  loading ??= new Promise((resolve, reject) => {
    w.CESIUM_BASE_URL = CESIUM;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${CESIUM}/Widgets/widgets.css`;
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = `${CESIUM}/Cesium.js`;
    script.async = true;
    script.onload = () => (w.Cesium ? resolve(w.Cesium) : reject(new Error("Cesium didn't load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Cesium didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** The 3D tiles key, for someone allowed to see this home (job record). */
async function tilesKey(recordKey: string): Promise<string> {
  const res = await fetch(`/api/map-tiles/key?record=${encodeURIComponent(recordKey)}`, { cache: "no-store" });
  const json = (await res.json()) as { ok: boolean; key?: string };
  if (!json.ok || !json.key) throw new Error("No 3D access");
  return json.key;
}

/** Shows the home in 3D in `el`, looking at it from the south-west. Returns a clean-up function. */
export async function showHouse3d(el: HTMLElement, at: { lat: number; lng: number }, recordKey: string): Promise<() => void> {
  const key = await tilesKey(recordKey);
  return showTileset(el, at, `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`, true);
}

/**
 * Nearmap's 3D model of a roof in `el` (9 Nov 2026, Martin), read through RENUABL's server so Nearmap's key never
 * reaches the browser (`/api/design/roof/mesh`). The day it was captured, and a clean-up function.
 */
export async function showNearmapMesh(el: HTMLElement, at: { lat: number; lng: number }): Promise<{ captured: string; close: () => void }> {
  const res = await fetch(`/api/design/roof/mesh?lat=${at.lat}&lng=${at.lng}`, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; root?: string; captured?: string; message?: string };
  if (!json.ok || !json.root) throw new Error(json.message ?? "Nearmap has no 3D model of this roof.");
  const close = await showTileset(el, at, json.root, false);
  return { captured: json.captured ?? "", close };
}

/** A 3D Tiles model in `el`, looking at the point from the south-west, free to turn and zoom. */
async function showTileset(el: HTMLElement, at: { lat: number; lng: number }, url: string, credits: boolean): Promise<() => void> {
  const Cesium = await loadCesium();
  const viewer = new Cesium.Viewer(el, {
    globe: false,
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: true,
  });
  const tileset = await Cesium.Cesium3DTileset.fromUrl(url, { showCreditsOnScreen: credits });
  viewer.scene.primitives.add(tileset);
  const point = Cesium.Cartographic.fromDegrees(at.lng, at.lat);
  // A Melbourne-ish ground height above the ellipsoid until the model gives the real one, seen from far enough back
  // that the house is in view either way.
  let height = 70;
  const look = (range: number) => {
    viewer.camera.lookAt(
      Cesium.Cartesian3.fromDegrees(at.lng, at.lat, height),
      new Cesium.HeadingPitchRange(Cesium.Math.toRadians(215), Cesium.Math.toRadians(-40), range),
    );
    // Then free to orbit and zoom round the house.
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    viewer.scene.requestRender();
  };
  look(140);
  // The real height, read off the model once its first tiles are in (9 Nov 2026: waiting on the most detailed sample
  // could hang with Nearmap's mesh, leaving the view on its loading line); the view is up meanwhile.
  const settle = () => {
    if (viewer.isDestroyed()) return;
    const h = viewer.scene.sampleHeight(point);
    if (Number.isFinite(h)) {
      height = h;
      look(65);
    }
  };
  tileset.initialTilesLoaded.addEventListener(settle);
  const late = window.setTimeout(settle, 8000);
  return () => {
    window.clearTimeout(late);
    if (!viewer.isDestroyed()) viewer.destroy();
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
