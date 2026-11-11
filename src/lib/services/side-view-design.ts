/**
 * The open design's panels, handed from the designer to the side views (12 Nov 2026, Martin: the panel design on
 * Nearmap's angled photos). The designer says what is on the roof as it changes; the side views read it when they
 * open. Only for the roof it was said for.
 */
import type { Point } from "@/lib/domain/design/roof-design";

let shared: { at: string; panels: Point[][] } | null = null;

const key = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

/** The designer: the panels on the open design, each as its corners in metres from the picture's middle. */
export function shareDesignPanels(lat: number, lng: number, panels: Point[][]): void {
  shared = { at: key(lat, lng), panels };
}

/** The side views: the panels on the design open at this roof, or none. */
export function designPanelsAt(lat: number, lng: number): Point[][] {
  return shared && shared.at === key(lat, lng) ? shared.panels : [];
}
