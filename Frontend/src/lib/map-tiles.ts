export type MapTileLayerConfig = {
  url: string;
  attribution: string;
};

/** Default basemap — no API key, no watermarks. */
const OSM: MapTileLayerConfig = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
};

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function cartoLightLayer(apiKey: string): MapTileLayerConfig {
  const key = encodeURIComponent(apiKey);
  return {
    url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${key}`,
    attribution: CARTO_ATTRIBUTION
  };
}

/**
 * Tile layer stack (first entry is primary).
 *
 * Default: OpenStreetMap — works out of the box, no key, no watermarks.
 *
 * Optional env (set at frontend build time in Coolify):
 * - VITE_CARTO_API_KEY — free key from https://carto.com/basemaps/apikey (light Carto style)
 * - VITE_MAP_TILE_URL — full custom URL (MapTiler, Mapbox, etc.)
 * - VITE_MAP_TILE_ATTRIBUTION — attribution HTML when using VITE_MAP_TILE_URL
 */
export function getMapTileLayers(): MapTileLayerConfig[] {
  const customUrl = import.meta.env.VITE_MAP_TILE_URL?.trim();
  if (customUrl) {
    const attribution =
      import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || CARTO_ATTRIBUTION;
    return [{ url: customUrl, attribution }];
  }

  const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
  if (cartoKey) {
    return [cartoLightLayer(cartoKey), OSM];
  }

  return [OSM];
}

/** Hostnames used by getMapTileLayers() — keep Backend CSP imgSrc in sync. */
export const MAP_TILE_IMG_SRC = [
  'https://*.basemaps.cartocdn.com',
  'https://*.tile.openstreetmap.org',
  'https://api.maptiler.com',
  'https://*.mapbox.com'
] as const;
