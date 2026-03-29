import maplibregl, { Map, NavigationControl } from "maplibre-gl";

export const DEFAULT_VIEW = {
  center: [-98.5795, 39.8283] as [number, number],
  zoom: 3
};

export const MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";

export function initMap(container: HTMLDivElement): Map {
  return new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom
  });
}

export function addMapControls(map: Map) {
  map.addControl(new NavigationControl(), "top-right");
}

export function resetMapView(map: Map) {
  map.easeTo({
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    duration: 450
  });
}
