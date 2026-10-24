import { describe, expect, it } from "vitest";
import { MAP_SIZE, cleanJobPlaces, cleanPlace, crowKm, directionsUrl, fitView, project, runFor, runKm, staticMapUrl } from "./job-map";

const base = { address: "1 Base St, Dandenong VIC", lat: -37.987, lng: 145.215 };
const awm = { address: "Clayton VIC", lat: -37.925, lng: 145.12 };
const other = { address: "Moorabbin VIC", lat: -37.94, lng: 145.06 };
const job = { label: "2 Hanwell Court", place: { address: "2 Hanwell Ct, Glen Waverley", lat: -37.89, lng: 145.17 } };

describe("the job map", () => {
  it("keeps places inside Australia with both figures, and nothing else", () => {
    expect(cleanPlace({ address: " Clayton ", lat: -37.925, lng: 145.12 })).toEqual({ address: "Clayton", lat: -37.925, lng: 145.12 });
    expect(cleanPlace({ address: "London", lat: 51.5, lng: -0.12 })).toBeNull();
    expect(cleanPlace({ lat: -37, lng: 145 })).toBeNull();
    expect(cleanJobPlaces({ base, collection: { "AWM Clayton": awm, Bad: { address: "x" } } })).toEqual({
      base,
      collection: { "AWM Clayton": awm },
    });
  });

  it("fits every point on the picture with room around it", () => {
    const view = fitView([base, awm, job.place]);
    for (const p of [base, awm, job.place]) {
      const at = project(p.lat, p.lng, view);
      expect(at.x).toBeGreaterThanOrEqual(56);
      expect(at.x).toBeLessThanOrEqual(MAP_SIZE.w - 56);
      expect(at.y).toBeGreaterThanOrEqual(56);
      expect(at.y).toBeLessThanOrEqual(MAP_SIZE.h - 56);
    }
    expect(fitView([job.place]).zoom).toBe(15);
  });

  it("runs from the base by the nearest collection point first, to the job, naming wholesalers with no point", () => {
    const run = runFor(
      { ...job, wholesalers: ["Moorabbin Supply", "AWM Clayton", "Nowhere Ltd"] },
      {
        base,
        collection: { "AWM Clayton": awm, "Moorabbin Supply": other },
      },
    );
    expect(run.stops.map((s) => s.label)).toEqual(["Base", "AWM Clayton", "Moorabbin Supply", "2 Hanwell Court"]);
    expect(run.unplaced).toEqual(["Nowhere Ltd"]);
    const km = runKm(run.stops);
    expect(km.legs).toHaveLength(3);
    // Each leg and the total are rounded on their own, so they agree to within a kilometre.
    expect(Math.abs(km.total - km.legs.reduce((n, l) => n + l, 0))).toBeLessThanOrEqual(1);
    expect(crowKm(base, awm)).toBeGreaterThan(9);
  });

  it("links directions through every stop, and keeps the key out of the browser's way", () => {
    const run = runFor({ ...job, wholesalers: ["AWM Clayton"] }, { base, collection: { "AWM Clayton": awm } });
    const url = new URL(directionsUrl(run.stops)!);
    expect(url.searchParams.get("origin")).toBe("-37.987,145.215");
    expect(url.searchParams.get("waypoints")).toBe("-37.925,145.12");
    expect(url.searchParams.get("destination")).toBe("-37.89,145.17");
    expect(directionsUrl([run.stops[0]])).toBeNull();
    const map = new URL(staticMapUrl({ lat: -37.9, lng: 145.1, zoom: 11 }, "KEY"));
    expect(map.searchParams.getAll("style").length).toBeGreaterThan(10);
    expect(map.searchParams.get("scale")).toBe("2");
  });
});
