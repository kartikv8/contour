export type MapStyleKey = "streets" | "satellite";

export const DEFAULT_MAP_STYLE: MapStyleKey = "streets";
export const HAS_MAPBOX_TOKEN = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

const MAPBOX_STREETS_STYLE_ID = "mapbox/streets-v12";
const MAPBOX_SATELLITE_STYLE_ID = "mapbox/satellite-streets-v12";

function buildMapboxStyleUrl(styleId: string, accessToken: string): string {
  return `https://api.mapbox.com/styles/v1/${styleId}?access_token=${accessToken}`;
}

export function getMapStyleUrl(styleKey: MapStyleKey): string {
  if (!HAS_MAPBOX_TOKEN) {
    return "https://demotiles.maplibre.org/style.json";
  }
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

  if (styleKey === "satellite") {
    return buildMapboxStyleUrl(MAPBOX_SATELLITE_STYLE_ID, token);
  }

  return buildMapboxStyleUrl(MAPBOX_STREETS_STYLE_ID, token);
}

export const DEFAULT_MAP_VIEW = {
  center: [-98.5795, 39.8283] as [number, number],
  zoom: 3,
};
