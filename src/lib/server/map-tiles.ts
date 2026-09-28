/**
 * Server only. The Map Tiles API key for the 3D house view (GOOGLE_MAP_TILES_KEY).
 * The 3D tiles load in the browser, so the key reaches it, but only for someone
 * allowed to see that home, and it should be restricted to the Map Tiles API
 * and the site's address in Google Cloud. Never the server's GOOGLE_MAPS_API_KEY.
 */
export function mapTilesKey() {
  return process.env.GOOGLE_MAP_TILES_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY?.trim() || null;
}
