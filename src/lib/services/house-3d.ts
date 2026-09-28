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
  const [key, Cesium] = await Promise.all([tilesKey(recordKey), loadCesium()]);
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
  const tileset = await Cesium.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`, {
    showCreditsOnScreen: true,
  });
  viewer.scene.primitives.add(tileset);
  const point = Cesium.Cartographic.fromDegrees(at.lng, at.lat);
  let height = 80; // a Melbourne-ish ground height until the tiles give the real one
  const look = () =>
    viewer.camera.lookAt(
      Cesium.Cartesian3.fromDegrees(at.lng, at.lat, height),
      new Cesium.HeadingPitchRange(Cesium.Math.toRadians(215), Cesium.Math.toRadians(-35), 65),
    );
  look();
  try {
    const [sample] = await viewer.scene.sampleHeightMostDetailed([point]);
    if (sample && Number.isFinite(sample.height)) {
      height = sample.height;
      look();
    }
  } catch {
    /* keep the estimate */
  }
  // Let the viewer orbit and zoom freely around the house.
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.scene.requestRender();
  return () => {
    if (!viewer.isDestroyed()) viewer.destroy();
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
